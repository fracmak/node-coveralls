#!/usr/bin/env node
'use strict';

var program = require('commander'),
    logger = require('../lib/logger')(),
    Q = require('q'),
    _ = require('lodash'),
    fs = require('fs'),
    index = require('../index');

function list(val) {
    return val.split(',');
}

program
    .version('0.0.1')
    .option('--lcovs <items>', 'list of lcov files', list)
    .option('--coveralls <items>', 'list of coveralls json files', list)
    .parse(process.argv);

index.getBaseOptions(function(err, options) {
    logger.debug(options);
    var promises = [];
    if (program.lcovs && program.lcovs.length > 0) {
        promises = promises.concat(program.lcovs.map(function(lcov) {
            return Q.nfcall(index.convertLcovToCoveralls, fs.readFileSync(lcov, {encoding: 'utf8'}), options);
        }));
    }
    if (program.coveralls && program.coveralls.length > 0) {
        promises = promises.concat(program.coveralls.map(function(coverall) {
            return new Q(JSON.parse(fs.readFileSync(coverall, {encoding: 'utf8'})));
        }));
    }
    if (!promises.length){
        program.outputHelp();
        return;
    }
    Q.all(promises).then(function() {
        console.log('sending coveralls.json to coveralls.io');
        var sourceFiles = _.flatten(_.pluck(Array.prototype.slice.apply(arguments)[0], 'source_files'));
        var coverallsJson = arguments[0][0];
        coverallsJson.source_files = sourceFiles;
        return Q.nfcall(index.sendToCoveralls, coverallsJson).spread(function(resp, body) {
            body = JSON.parse(body);
            console.log(body.message);
            console.log(body.url);
        });
    }, function(err) {
        logger.error('failed', err);
    });
});