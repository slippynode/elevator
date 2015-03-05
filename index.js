#!/usr/bin/env node

var _ = require('lodash')
  , async = require('async')
  , fs = require('fs')
  , gdal = require('gdal')
  , path = require('path')
  , program = require('commander')
  , queue = []
  , util = require('util')
;

program
  .version('0.0.1-dev')
  .option('-p, --path [value]', 'Path to look for raster datasets')
  .option('-o,  --outpath [value]', 'Path to write out files')
  .option('-l, --list', 'List all raster datasets in directory')
  .option('-m, --metadata', 'Display raster metadata')
  .option('-s, --stream', 'Operate on a stream of JSON')
  .option('-b, --bounds [value]', 'Get Bounding Box for a feature')
  .option('-r, --reproject', 'Reproject raster(s) to EPSG:4326')
  .parse(process.argv)
;

if (program.path && program.list)
  queue.push(listRasters());
if (program.path && program.metadata)
  queue.push(displayMetadata);
if (program.stream && program.bounds)
  queue.push(calculateBounds);
if (program.path && program.outpath && program.reproject)
  queue.push(reprojectRaster);
async.series(queue)

function reprojectRaster () {

  if (fs.statSync(program.path).isFile()) {
    reproject(program.path);
  }
  else {
    listRasters(function (rasters) {
      _.each(rasters, function (raster) {
        raster = path.join(program.path, raster);
        reproject(raster);
      });
    });
  }

  function reproject(filePath) {

    var src
      , w
      , h
      , sSrs
      , tSrs
      , parsed
      , out
      , driver
      , geoTransform
      , res
      , tw
      , th
    ;

    src = gdal.open(filePath);
    driver = 'GTiff';
    w = src.rasterSize.x;
    h = src.rasterSize.y;

    geoTransform = src.geoTransform;

    res = {
      x: geoTransform[1],
      y: geoTransform[5]
    };

    tw = Math.ceil(res.x);
    th = Math.ceil(res.y);

    sSrs = src.srs;
    tSrs = gdal.SpatialReference.fromUserInput('EPSG:4326');

    parsed = path.parse(filePath);
    out = path.join(program.outpath, parsed.name + parsed.ext);
    dst = gdal.open(out, 'w', driver, tw, th);

    gdal.reprojectImage({
      src: src,
      dst: out,
      s_srs: sSrs,
      t_srs: tSrs
    });

  };

};

function stream (callback) {

  var response = '';
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function (chunk) {
    response += chunk;
  });

  process.stdout.on('error', function (error) {
    callback(error);
  });

  process.stdin.on('end', function () {
    callback(null, response);
  });

};

function calculateBounds () {

  stream(function (error, data) {
    if (error) throw error;

    var bounds
      , lineString
    ;

    lineString = new gdal.LineString()

    data = JSON.parse(data);

    _.each(data.coordinates, function (c) {
      lineString.points.add(new gdal.Point(c[0], c[1]));
    });

    bounds = lineString.getEnvelope();
  });

};

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

  if (fs.statSync(program.path).isFile()) {
    metadata(program.path);
  }
  else {
    listRasters(function (rasters) {
      _.each(rasters, function (raster) {
        raster = path.join(program.path, raster);
        metadata(raster);
      });
    });
  }

  function metadata (filePath) {

    var cornerNames
      , coordTransform
      , corners
      , driver
      , driverMetadata
      , ds
      , geotransform
      , size
      , wgs84
    ;

    ds = gdal.open(filePath);

    driver = ds.driver;
    driverMetadata = driver.getMetadata();

    if (driverMetadata['DCAP_RASTER'] !== 'YES') {
      console.error('Source file is not a raster');
      process.exit(1);
    }

    console.log('Driver: ' + driver.description);

    size = ds.rasterSize;
    console.log('Size is ' + size.x + ', ' + size.y);

    console.log('Coordinate System is: ');
    console.log(ds.srs.toPrettyWKT());

    geotransform = ds.geoTransform;
    console.log('Origin = (' + geotransform[0] + ', ' + geotransform[3] + ')');
    console.log('Pixel Size = (' + geotransform[1] + ', ' + geotransform[5] + ')');
    console.log('GeoTransform =');
    console.log(geotransform);

    corners = {
      'Upper Left  ' : {x: 0, y: 0},
      'Upper Right ' : {x: size.x, y: 0},
      'Bottom Right' : {x: size.x, y: size.y},
      'Bottom Left ' : {x: 0, y: size.y},
      'Center      ' : {x: size.x/2, y: size.y/2}
    };

    wgs84 = gdal.SpatialReference.fromEPSG(4326);
    coordTransform = new gdal.CoordinateTransformation(ds.srs, wgs84);

    console.log("Corner Coordinates:")
    cornerNames = Object.keys(corners);
    cornerNames.forEach(function(cornerName) {
      var corner
        , description
        , ptOrig
        , ptWgs84
      ;

      corner = corners[cornerName]
      ptOrig = {
        x: geotransform[0] + corner.x * geotransform[1] + corner.y * geotransform[2],
        y: geotransform[3] + corner.x * geotransform[4] + corner.y * geotransform[5]
      };
      ptWgs84 = coordTransform.transformPoint(ptOrig);
      description = util.format('%s (%d, %d) (%s, %s)',
        cornerName,
        Math.floor(ptOrig.x * 100) / 100,
        Math.floor(ptOrig.y * 100) / 100,
        gdal.decToDMS(ptWgs84.x, 'Long'),
        gdal.decToDMS(ptWgs84.y, 'Lat')
      );
      console.log(description);
    });

  };

};