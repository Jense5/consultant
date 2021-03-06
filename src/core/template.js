// @flow

import klaw from 'klaw';
import path from 'path';
import chalk from 'chalk';
import rfse from 'fs-extra';
import winston from 'winston';
import Promise from 'bluebird';
import Mustache from 'mustache';
import inquirer from 'inquirer';
import SystemJS from 'systemjs';

import utils from '../utils/utils';

const fse = Promise.promisifyAll(rfse);
SystemJS.config({
  transpiler: 'plugin-babel',
  map: {
    'plugin-babel': path.resolve(__dirname, '../../node_modules/systemjs-plugin-babel/plugin-babel.js'),
    'systemjs-babel-build': path.resolve(__dirname, '../../node_modules/systemjs-plugin-babel/systemjs-babel-browser.js'),
  },
});

/**
 * This class represents a template, which will be able to render to some output location.
 * All the data and render processes are stored in this instance.
 */
class Template {

  filters: Map<string, (options: Object) => boolean>;
  source: string;
  start: string;
  root: string;
  end: string;

  input: Object;
  questions: Array<Object>;
  staticExtensions: Array<string>;

  introduction: string;
  summary: (input: Object) => string;

  constructor(root: string): void {
    this.root = root;
    this.filters = new Map();
    this.ask();
    this.setEnd();
    this.setInput();
    this.setStart();
    this.setSummary();
    this.setIntroduction();
    this.setSourceFolder();
    this.dontTouchExtensions();
  }

  ask(qs: Array<Object> = []): void { this.questions = qs; }
  setInput(input: Object = {}): void { this.input = input; }
  setIntroduction(intro: string = ''): void { this.introduction = intro; }
  setEnd(end: string = process.env.defaultEnd || '}}'): void { this.end = end; }
  setStart(start: string = process.env.defaultStart || '{{'): void { this.start = start; }
  setSummary(summary: (input: Object) => string = () => ''): void { this.summary = summary; }
  setSourceFolder(source: string = process.env.defaultTemplateSource = 'template'): void { this.source = source; }

  path(): string { return path.resolve(this.root, this.source); }
  filter(f: string, fl: (options: Object) => boolean): void { this.filters.set(f, fl); }
  configurationPath(): string { return path.resolve(this.root, process.env.configurationFile || ''); }

  dontTouchExtensions(extensions: Array<string> = []) { this.staticExtensions = extensions; }

  ignore(f: string): void { this.filters.set(f, () => false); }
  ignoreRecursive(f: string): void {
    const location = path.resolve(this.path(), f);
    Template.readFilePaths(location).then((data) => {
      data.map(file => path.relative(this.path(), file))
      .map(file => this.ignore(file));
    });
  }

  /**
   * Checks whether or not the given file should be rendered. This is done by checking wether or
   * or not this file is in the filters hashmap. If it is not, it will definetely be rendered. If
   * it is, it will be rendered if the corresponding filter function returns true, based on the
   * current input.
   * @param {string} file The file location that should be checked
   * @returns {boolean} True if and only if the file should be rendered
   */
  shouldRender(file: string): boolean {
    if (!this.filters.has(path.relative(this.path(), file))) { return true; }
    const checker = this.filters.get(path.relative(this.path(), file));
    return !!checker && checker(this.input);
  }

  /**
   * Returns a promise containing all the absolute file paths of all the children (recursive) of
   * this templates' path. The path that will be checked is the this.path() path.
   * @returns {Promise<Array<string>>} A promise with the list of files
   */
  readTemplateFilePaths(): Promise<Array<string>> { return Template.readFilePaths(this.path()); }

  /**
   * Renders the given file to the given output location. Returns promise which notifies when done.
   * @param {string} file The absolute file path of the file to render
   * @param {string} output The absolute file path of the output file
   * @returns {Promise<>} A promise to notify when done
   */
  renderFile(file: string, output: string): Promise<> {
    return fse.ensureDirAsync(path.dirname(output))
    .then(() => {
      if (this.staticExtensions.indexOf(path.extname(file)) <= -1) {
        return fse.readFileAsync(file, 'utf8')
        .then(data => Mustache.render(data, this.input))
        .then(data => fse.writeFileAsync(output, data))
        .then(() => winston.debug(`Rendered ${chalk.yellow(file)} in ${chalk.cyan(output)}`));
      }
      return fse.copyAsync(file, output);
    });
  }

  /**
   * Renders this template, with all the data that is setup. It will print the introduction, ask
   * for parameters, render all the files needed and print a summary.
   * @param {string} output The output directory for the generated template
   * @returns {Promise<>} A promise to notify when done
   */
  render(output: string): Promise<> {
    return new Promise((resolve) => {
      SystemJS.import(this.configurationPath()).then((setup) => {
        setup.default(this);
        Mustache.tags = [this.start, this.end];
        utils.info(this.introduction);
        inquirer.prompt(this.questions).then((answers) => {
          this.input = answers;
          this.readTemplateFilePaths().then((files) => {
            const filtered = files.filter(file => this.shouldRender(file));
            Promise.map(filtered.filter(file => fse.statSync(file).isFile()), (file) => {
              this.renderFile(file, path.resolve(output, path.relative(this.path(), file)));
            }).then(() => {
              utils.info(this.summary(this.input));
              resolve();
            });
          });
        });
      }).catch(winston.error);
    });
  }

  /**
   * Returns a promise containing all the absolute file paths of all the children (recursive) of
   * the given path. The path that will be checked is the provided location parameter.
   * @param {string} location The location of the directory to check
   * @returns {Promise<Array<string>>} A promise with the list of files
   */
  static readFilePaths(location: string = '.'): Promise<Array<string>> {
    return new Promise((resolve, fail) => {
      const items = [];
      klaw(location)
      .on('data', (item) => { items.push(item.path); })
      .on('end', () => { resolve(items); })
      .on('error', (error) => { fail(error); });
    });
  }

}

module.exports = Template;
