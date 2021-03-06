// @flow

import path from 'path';
import chalk from 'chalk';
import winston from 'winston';
import rfse from 'fs-extra';
import Promise from 'bluebird';
import Template from './template';

const fse = Promise.promisifyAll(rfse);

/**
 * Checks if the installed template with given name is a boilerplate are not. For the exact
 * definition of a boilerplate (vs template), please take a look at the documenation on Github.
 * @param {string} name The name of the template to check if it is a boilerplate
 * @returns {boolean} True if and only if the template with given name is a boilerplate
 */
const isBoilerplate = (name: string): boolean =>
  !!name && !fse.existsSync(path.resolve(process.env.templates || '.', name, process.env.configurationFile || ''));

/**
 * Creates a boilerplate with given name in the output directory. If the output directory does not
 * exist, it will be created. The boilerplate with given name should exist, as it is not being
 * checked here. Do never pass the name of a boilerplate that does not exist!
 * @param {string} name The name of the boilerplate to create
 * @param {string} output The output location of the boilerplate
 * @returns {Promise<>} A promise that will notify when the creation is finished
 */
const createBoilerplate = (name: string, output: string): Promise<> =>
  fse.ensureDirAsync(output)
  .then(() => fse.copyAsync(path.resolve(process.env.templates || '.', name), output))
  .then(() => {
    if (process.env.neverRenderGitFolder === 'true'
        && fse.existsSync(path.resolve(output, '.git'))) {
      fse.removeSync(path.resolve(output, '.git'));
    }
  });

/**
 * Creates a template with given name in the output directory. If the output directory does not
 * exist, it will be created. The template with given name should exist, as it is not being
 * checked here. Do never pass the name of a template that does not exist!
 * @param {string} name The name of the template to create
 * @param {string} output The output location of the template
 * @returns {Promise<>} A promise that will notify when the creation is finished
 */
const createTemplate = (name: string, output: string): Promise<> =>
  fse.ensureDirAsync(output).then(() =>
    new Template(path.resolve(process.env.templates || '.', name)).render(output));

/**
 * Creates a new project from the template with given name. The function supposes that the template
 * already exists, so checking making sure this is correct should be done before this function is
 * called. It will detect whether it is a template or boilerplate and react accordingly. It is not
 * necessary for the ouput directory to exist.
 * @param {string} name The name of the template to create
 * @param {string} output The output of directory of the new project
 * @returns {Promise<>} A promise that will notify when the creation is finished
 */
const create = (name: string, output: string): Promise<> =>
  new Promise((resolve, fail) => {
    winston.debug(`Command ${chalk.yellow('CREATE')} called for ${chalk.cyan(name)} and ${chalk.cyan(output)}`);
    const absoluteOutputPath = output ? path.resolve(process.cwd(), output) : process.cwd();
    winston.debug(`Using output path: ${chalk.magenta(absoluteOutputPath)}`);
    if (isBoilerplate(name)) {
      winston.debug(`Detected boilerplate ${chalk.green(name)}`);
      createBoilerplate(name, absoluteOutputPath).then(resolve).catch(fail);
    } else {
      winston.debug(`Detected template ${chalk.green(name)}`);
      createTemplate(name, absoluteOutputPath).then(resolve).catch(fail);
    }
  });

export default create;
