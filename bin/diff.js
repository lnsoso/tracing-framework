#!/usr/bin/env node
/**
 * Copyright 2012 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Diff tool.
 *
 * @author benvanik@google.com (Ben Vanik)
 */

var toolRunner = require('./tool-runner');
var util = toolRunner.util;
toolRunner.launch(runTool);


/**
 * Diff tool.
 * @param {!wtf.pal.IPlatform} platform Platform abstraction layer.
 * @param {!Array.<string>} args Command line arguments.
 * @return {number|!goog.async.Deferred} Return code or a deferred that is
 *     called back when the tool exits.
 */
function runTool(platform, args) {
  var ALIGN_RIGHT = -8; // 8 chars wide, right aligned

  var inputFile1 = args[0];
  var inputFile2 = args[1];
  var filterString = args[2];
  if (!inputFile1 || !inputFile2) {
    console.log('usage: diff.js file1.wtf-trace file2.wtf-trace [filter]');
    return -1;
  }
  console.log('Diffing ' + inputFile1 + ' and ' + inputFile2 + '...');
  console.log('');

  var filter = null;
  if (filterString) {
    filter = new wtf.analysis.EventFilter(filterString);
  }

  // Create databases for querying.
  var db1 = wtf.analysis.loadDatabase(inputFile1);
  var db2 = wtf.analysis.loadDatabase(inputFile2);

  // Build event data tables.
  var table1 = new wtf.analysis.db.EventDataTable(db1, filter);
  var table2 = new wtf.analysis.db.EventDataTable(db2, filter);

  // Grab all event types from each table and divide by type.
  var allInstanceEntryNames =
      wtf.analysis.db.EventDataTable.getAllEventTypeNames(
          [table1, table2], wtf.data.EventClass.INSTANCE);
  var allScopeEntryNames =
      wtf.analysis.db.EventDataTable.getAllEventTypeNames(
          [table1, table2], wtf.data.EventClass.SCOPE);

  // Dump scope events.
  console.log(util.spaceValues(
      [ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT],
      'Count', 'Total', 'Average'));
  console.log('');
  allScopeEntryNames.sort(function(nameA, nameB) {
    var entryA1 = table1.getEventTypeEntry(nameA);
    var entryA2 = table2.getEventTypeEntry(nameA);
    var diffA = Math.abs(entryA1.getMeanTime() - entryA2.getMeanTime());
    var entryB1 = table1.getEventTypeEntry(nameB);
    var entryB2 = table2.getEventTypeEntry(nameB);
    var diffB = Math.abs(entryB1.getMeanTime() - entryB2.getMeanTime());
    return diffA - diffB;
  });
  for (var n = 0; n < allScopeEntryNames.length; n++) {
    var eventTypeName = allScopeEntryNames[n];
    var entry1 = table1.getEventTypeEntry(eventTypeName);
    var entry2 = table2.getEventTypeEntry(eventTypeName);
    var hasEntry1 = entry1 && entry1.getCount();
    var hasEntry2 = entry2 && entry2.getCount();
    if (!hasEntry1 && !hasEntry2) {
      continue;
    }

    var diff =
        (hasEntry1 ? entry1.getMeanTime() : 0) -
        (hasEntry2 ? entry2.getMeanTime() : 0);
    var color = '';
    if (diff < 0) {
      color = '\033[31m';
    } else if (diff > 0) {
      color = '\033[32m';
    }

    console.log(color + eventTypeName + '\033[0m');
    if (hasEntry1) {
      console.log(util.spaceValues(
          [ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT],
          String(entry1.getCount()),
          wtf.util.formatSmallTime(entry1.getUserTime()),
          wtf.util.formatSmallTime(entry1.getMeanTime())));
    } else {
      console.log('(not present in input 1)');
    }
    if (hasEntry2) {
      console.log(util.spaceValues(
          [ALIGN_RIGHT, ALIGN_RIGHT, ALIGN_RIGHT],
          String(entry2.getCount()),
          wtf.util.formatSmallTime(entry2.getUserTime()),
          wtf.util.formatSmallTime(entry2.getMeanTime())));
    } else {
      console.log('(not present in input 2)');
    }
    console.log('');

    // drawDistribution(entry1.getDistribution());
    // drawDistribution(entry2.getDistribution());
  }

  db1.dispose();
  db2.dispose();
  return 0;
};


function drawDistribution(buckets) {
  var first = buckets.length;
  var last = 0;
  var max = Number.MIN_VALUE;
  for (var n = 0; n < buckets.length; n++) {
    var value = buckets[n];
    if (value) {
      first = Math.min(first, n);
      last = Math.max(last, n);
      max = Math.max(max, value);
    }
  }
  var span = last - first;
  for (var n = first; n <= last; n++) {
    var value = buckets[n];
    var line = util.pad(n, -3) + 'ms - ' +
        util.pad(value, -4) + ': ';
    if (value) {
      var span = [];
      for (var m = 0; m < value; m++) {
        span.push('-');
      }
      span.push('*');
      line += span.join('');
    }
    console.log(line);
  }
};
