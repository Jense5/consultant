#!/usr/bin/env node

// @flow

import rfs from 'fs';
import path from 'path';
import chalk from 'chalk';
import winston from 'winston';
import commander from 'commander';

import utils from './utils/utils';
import setup from './utils/setup';
import content from './utils/content';

import add from './inter/add';
import help from './inter/help';
import list from './inter/list';
import batch from './inter/batch';
import reset from './inter/reset';
import update from './inter/update';
import remove from './inter/remove';
import create from './inter/create';
import snapshot from './inter/snapshot';
import exportCommand from './inter/export';

// Load the default package configuration in order to have access
// to the current version, so we can present it to the user.
const pkg = path.resolve(__dirname, '../package.json');
const pack = JSON.parse(rfs.readFileSync(pkg, 'utf8'));

// Parse the command line arguments
commander
.version(chalk.bold(`v${pack.version}`))
.usage('<command> [options]')
.option('-v, --verbose', 'verbose mode')
.option('-h, --hard', 'hard reset mode')
.parse(process.argv);

// Present the command and version number to the user, so if there
// are some bugs, he can always identify the version he used.
const command = commander.args.length > 0 ? `${commander.args[0].toUpperCase()} ` : '';
utils.info(`Consultant ${command}v${pack.version}`);

// Set the level of winston so it is easy to debug! This winston
// instance will be used everywhere in the tool.
if (commander.verbose) { winston.level = 'debug'; }
winston.debug(chalk.yellow('Processed arguments'));

// Setup the basic configuration with the setup file. It loads
// the dotenc configuration and makes sure the necessary files exist.
setup();

// Process the correct command and link it to the correct callback in
// the /inter directory. If no (or invalid) command is provided, print
// corresponding message.
if (commander.args.length < 1) {
  utils.info(content.invalidCommand());
  process.exit();
}

// Loop through all the possible commands untill the correct one is found.
// I know, hashmaps are O(1) and this is O(n), but I don't care for 7 items.
winston.debug('Starting to call commands');
switch (commander.args[0].toUpperCase()) {
  case 'HELP': help(); break;
  case 'LIST': list(); break;
  case 'RESET': reset(commander.hard); break;
  case 'ADD': add(...commander.args.slice(1)); break;
  case 'BATCH': batch(...commander.args.slice(1)); break;
  case 'UPDATE': update(...commander.args.slice(1)); break;
  case 'CREATE': create(...commander.args.slice(1)); break;
  case 'REMOVE': remove(...commander.args.slice(1)); break;
  case 'SNAPSHOT': snapshot(...commander.args.slice(1)); break;
  case 'EXPORT': exportCommand(...commander.args.slice(1)); break;
  default:
    utils.info(content.invalidCommand());
    process.exit();
}
