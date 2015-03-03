#!/usr/bin/env node

var async = require('async')
  , fs = require('fs')
  , gdal = require('gdal')
  , path = require('path')
  , program = require('commander')
  , queue = []
;

program
  .version('0.0.1-dev')
  .option('-p, --path', 'Path to look for raster datasets in')
  .option('-l, --list', 'List all raster datasets in directory')
  .parse(process.argv)
;

if (program.directory && program.list) queue.push(listRasters);
async.series(queue)

function listRasters () {
  var files
    , file
    , i
  ;

  files = fs.readdirSync(program.path);
  for (i = 0; i < files.length; i++) {
    file = files[i];
    if (path.extname(file) === '.tif') {
      process.stdout.write(file);
    }
  }
};

