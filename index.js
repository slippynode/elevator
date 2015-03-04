#!/usr/bin/env node

var _ = require('lodash')
  , async = require('async')
  , fs = require('fs')
  , gdal = require('gdal')
  , path = require('path')
  , program = require('commander')
  , queue = []
;

program
  .version('0.0.1-dev')
  .option('-p, --path [value]', 'Path to look for raster datasets')
  .option('-l, --list', 'List all raster datasets in directory')
  .option('-m, --metadata', 'Display raster metadata')
  .parse(process.argv)
;

if (program.path && program.list) queue.push(listRasters());
if (program.path && program.metadata) queue.push(displayMetadata);
async.series(queue)


function listRasters (callback) {

  var files
    , rasters
    , i
  ;

  files = fs.readdirSync(program.path);
  rasters = _.filter(files, function (f) {return path.extname(f) === '.tif'});

  if (typeof(callback) === 'function') {
    callback(rasters);
  }
  else {
    _.each(rasters, function (raster) {
      process.stdout.write(raster + '\n');
    });
  }

};

function displayMetadata () {

  var dataset;

  if (fs.statSync(program.path).isFile()) {
    dataset = gdal.open(program.path);
    console.log("number of bands: " + dataset.bands.count());
    console.log("width: " + dataset.rasterSize.x);
    console.log("height: " + dataset.rasterSize.y);
    console.log("geotransform: " + dataset.geoTransform);
    console.log("srs: " + (dataset.srs ? dataset.srs.toWKT() : 'null'));
    console.log("metadata: %j", dataset.getMetadata());
    console.log("");
    console.log("band 1: ", dataset.bands.get(1));
  }

};






















