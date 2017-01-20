// @flow

import rfs from 'fs';
import path from 'path';
import winston from 'winston';
import Promise from 'bluebird';
import mkdirp from 'mkdirp';
import handlebars from 'handlebars';

// import write from './write';
// import render from './render';

const fs = Promise.promisifyAll(rfs);
const mkdir = Promise.promisify(mkdirp);

/**
 * Reads all files in the given directory and subdirectories. Returns a promise with an
 * Array<string> that contains all the absolute paths of the found files. The promise will reject
 * when something went wrong while reading the directory or one of the subdirectories. If the
 * given path is a file and not a directory, it will also reject. An optional list of strings
 * can be provided as a second argument which will be merged with the list of results. This makes
 * it possible to call this function recursively.
 * @param {string} location The location of the directory to check
 * @param {?Array<string>} previous The previous paths to merge with the results list
 * @returns {Promise<Array<string>>} A promise with the read data
 */
const discover = (location: string, previous: Array<string> = []): Promise<Array<string>> =>
  new Promise((resolve, reject) => {
    fs.readdirAsync(location).then((files) => {
      const names = files.map(file => path.resolve(location, file));
      Promise.map(names, name => fs.statAsync(name)).then((results) => {
        const data = results.map((v, i) => ({ k: names[i], v: v.isFile() }));
        const cf = data.filter(e => e.v).map(e => path.resolve(path.dirname(location), e.k));
        const cd = data.filter(e => !e.v).map(e => path.resolve(path.dirname(location), e.k));
        Promise.reduce(cd, (f, d) => discover(d, f).then(acc => acc), [])
        .then(sf => resolve([...previous, ...cf, ...sf]));
      });
    }).catch(reject);
  });

/**
 * Transfers a file with given name (which is the relative path within the template folder) to the
 * same relative location within the given (optional) location directory. The options will be
 * parsed and the files will be formatted with the handlebars render engine.
 * @param {string} name The name of the file to clone.
 * @param {Object} options The options for the rendering engine.
 * @param {string} location The location of the destination folder.
 * @returns {Promise<>} A promise to know when the cloner is ready.
 */

const render = (file: string, opts: Object, output: string): Promise<> =>
  new Promise((resolve, reject) => {
    mkdir(path.dirname(output))
    .then(() => fs.readFileAsync(file, 'utf8'))
    .then(data => handlebars.compile(data)(opts))
    .then(data => resolve(fs.writeFileAsync(output, data)))
    .catch(reject);
  });

const createBoilerplate = (templ: string, opts: Object, dest: string = process.cwd()): Promise<> =>
  new Promise((resolve, reject) => {
    discover(templ)
    .then((files) => {
      Promise.map(files, (file) => {
        render(file, opts, path.resolve(dest, path.relative(templ, file)));
      }).then(resolve);
    }).catch(reject);
  });

/**
 * Transfers the complete template in the /template directory into the given location. If the
 * location does not exists, it will be created. The given options will be used to pass through
 * to the rendering engine.
 * @param {Object} options The options for the rendereing engine.
 * @param {string} location The location to clone the files to.
 * @returns {Promise<>} A promise to know when the process is finished.
 */
const transferTemplate = (opts: Object, dest: string = process.cwd()): Promise<> =>
  createBoilerplate(path.resolve(__dirname, '../template'), opts, dest);

export default transferTemplate;
