// QMiner - Open Source Analytics Platform
// 
// Copyright (C) 2014 Jozef Stefan Institute
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License, version 3,
// as published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

//#
//# ### visualization.js (use require)
//#
//# Functions for visualizing data
//# The library must be loaded using `var vis = require('visualization.js');`.
//# 
//# **Functions and properties:**
//#


if (typeof exports == 'undefined') {
    // client side functions must not use require!
    exports = {};
} else {
    // server side functions such as highchartsTSConverter require time
    time = require('time.js');
}


// array of multimeasurements to array of univariate time series. Input time stamps are strings. Output time stamps are milliseconds from 1970.
// Input: [{ema : {Val : v1, Time : t1}, tick : {Val : v2, Time : t2}}, {ema : {Val : v3, Time : t3}, tick : {Val : v4, Time : t4}}]
// Output: [{name : "ema", data : [[t1, v1], [t3, v3]]} , {name : "tick", data : [[t2, v2], [t4, v4]] }]
//#- `objJson = vis.highchartsTSConverter(objJson)` -- array of multimeasurements to array of univariate time series. Input time stamps are strings. Output time stamps are milliseconds from 1970.
exports.highchartsTSConverter = function (dataJson) {
    var result = [];
    var temp = {};
    for (key in dataJson[0]) {
        temp[key] = [];
    }
    for (objN = 0; objN < dataJson.length; objN++) {
        var obj = dataJson[objN];
        for (key in obj) {
            var tm = time.parse(obj[key].Time);
            var longtime = 1000 * tm.timestamp + tm.millisecond;
            temp[key].push([longtime, obj[key].Val]);
        }
    }
    for (key in temp) {
        result.push({ name: key, data: temp[key] });
    }
    return result;
};

// record set JSON to array of univariate time series. Input time stamps are strings. Output time stamps are milliseconds from 1970.
// Input: {"$hits":432,"records":[{"$id":0,"datetime":"t1","mcutmp_avg":v11,"mcutmp_min":v12,"mcutmp_max":v13},{"$id":1,"datetime":"t2","mcutmp_avg":v21,"mcutmp_min":v22,"mcutmp_max":v23}]}
// Output: [{name : "mcutmp_avg", data : [[t1, v11], [t2, v21]]} , {name : "mcutmp_min", data : [[t1, v12], [t2, v22]] }, {name : "mcutmp_max", data : [[t1, v13], [t2, v23]] }]
//#- `objJson = vis.highchartsConverter(fieldsJson, objJson)` -- arecord set JSON to array of univariate time series. Input time stamps are strings. Output time stamps are milliseconds from 1970.
exports.highchartsConverter = function (fieldsJson, dataJson) {

    var keys = {};
    var datetime;
    for (key in fieldsJson) {
        if (fieldsJson[key].type != "datetime") {
            keys[fieldsJson[key].name] = [];
            //console.log("" + fieldsJson[key].name);  
        } else datetime = fieldsJson[key].name;
    }
    //printj(keys)

    var result = [];
    for (objN = 0; objN < dataJson.records.length; objN++) {
        var obj = dataJson.records[objN];
        for (key in obj) {
            var longtime;
            if (key == datetime) {
                var tm = time.parse(obj[key]);
                longtime = 1000 * tm.timestamp + tm.millisecond;
            } else {
                if (keys[key]) {
                    keys[key].push([longtime, obj[key]]);
                    //console.log(longtime + " " + JSON.stringify(obj[key]));
                }
            }
        }
    }
    for (key in keys) {
        //console.log(JSON.stringify(keys[key]));
        result.push({ name: key, data: keys[key] });
    }
    return result;
}

//exports.highchartsConverterPro = function (converterParams, dataJson) {   
//    // Predefine result structure. Fields has to be dfined in converterParams.fields
//    var result = [];
//    converterParams.fields.forEach(function (field, fieldIdx) {
//        result[fieldIdx] = { "name": field.name, "data": [] };
//    });

//    dataJson.records.forEach(function (rec) {
//        var tm = time.parse(rec[converterParams.timeField]);
//        var longtime = 1000 * tm.timestamp + tm.millisecond;

//        converterParams.fields.forEach(function (field, fieldIdx) {
//            // Maybe check if someone has accidentelly put timeField also in fields and skip it. 
//            result[fieldIdx].data.push([longtime, field.get(rec)]);
//        });
//    });

//    return result;
//}


exports.highchartsConverterPro = function (converterParams, dataJson) {
    // Predefine result structure. Fields has to be dfined in converterParams.fields
    var result = [];
    converterParams.fields.forEach(function (field, fieldIdx) {
        result[fieldIdx] = { "name": field.name, "data": [] };
    });

    dataJson.records.forEach(function (rec) {
        converterParams.fields.forEach(function (field, fieldIdx) {
            var tm = time.parse(field.getTm(rec));
            var longtime = 1000 * tm.timestamp + tm.millisecond;
            result[fieldIdx].data.push([longtime, field.get(rec)]);
        });
    });

    return result;
}

exports.highchartsConverterColumn = function (converterParams, dataJson) {
    // Predefine result structure. Fields has to be dfined in converterParams.fields
    var result = [];
    converterParams.fields.forEach(function (field, fieldIdx) {
        result[fieldIdx] = { "name": field.name, "data": [] };
    });

    dataJson.Predictions.forEach(function (rec) {
        converterParams.fields.forEach(function (field, fieldIdx) {
            result[fieldIdx].data.push(field.get(rec));
        });
    });

    return result;
}

exports.highchartsParams = function () {
    return {
        chart: {
            type: 'spline'
        },
        title: {
            text: 'spline chart'
        },
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats: { // don't display the dummy year
                month: '%e. %b',
                year: '%b'
            },
            title: {
                text: 'Time'
            }
        },
        yAxis: {
            title: {
                text: 'Val'
            },
            //min: 0
        },
        tooltip: {
            headerFormat: '<b>{series.name}</b><br>',
            pointFormat: '{point.x:%e. %b}: {point.y:.2f} '
        },
        //[{ "name": "tick", "data": [[1407427442309, 0.207912], [1407427443309, 0.309017], [1407427444309, 0.406737], [1407427445309, 0.5], [1407427446309, 0.587785], [1407427447309, 0.669131], [1407427448309, 0.743145], [1407427449309, 0.809017], [1407427450309, 0.866025], [1407427451309, 0.913545]] }, { "name": "js", "data": [[1407427442309, 5.207912], [1407427443309, 5.309017], [1407427444309, 5.406737], [1407427445309, 5.5], [1407427446309, 5.587785], [1407427447309, 5.669131], [1407427448309, 5.743145], [1407427449309, 5.809017], [1407427450309, 5.866025], [1407427451309, 5.913545]] }, { "name": "ema", "data": [[1407427442309, 0], [1407427443309, 0], [1407427444309, 0.005917], [1407427445309, 0.013315], [1407427446309, 0.022087], [1407427447309, 0.032111], [1407427448309, 0.043254], [1407427449309, 0.055368], [1407427450309, 0.068297], [1407427451309, 0.081876]] }]
        series: []
    }
};

exports.googleAnnotatedTimeLineParams = function () {
    return {
        'colors': ['blue'], // The colors to be used
        'displayAnnotations': false,
        'displayExactValues': true, // Do not truncate values (i.e. using K suffix)
        'displayRangeSelector': true, // display the range selector
        'displayZoomButtons': true, // display the zoom buttons
        'fill': 30, // Fill the area below the lines with 20% opacity
        'scaleColumns': [0, 1], // Have two scales, by the first and second lines
        'scaleType': 'allfixed', // See docs...
        'thickness': 2, // Make the lines thicker
        //'zoomStartTime': new Date(2011, 7, 1), //NOTE: month 1 = Feb (javascript to blame)
        //'zoomEndTime': new Date(2012, 10, 1) //NOTE: month 1 = Feb (javascript to blame)
    };
}

// given an array of strings representing absolute file paths, the function reads all files, concatenates them and returns the string
function glueFileContents(strArr) {
    var res = "";
    for (var elN = 0; elN < strArr.length; elN++) {
        res += fs.openRead(strArr[elN]).readAll();
    }
    return res;
};

function isObjectAndNotArray(object) {
    return (typeof object === 'object' && !Array.isArray(object));
};

// 'createNew' defaults to false
function overwriteKeys(baseObject, overrideObject, createNew) {
    if (createNew) {
        baseObject = JSON.parse(JSON.stringify(baseObject));
    }
    if (typeof overrideObject != 'undefined') {
        Object.keys(overrideObject).forEach(function (key) {
            if (isObjectAndNotArray(baseObject[key]) && isObjectAndNotArray(overrideObject[key])) {
                overwriteKeys(baseObject[key], overrideObject[key]);
            }
            else {
                baseObject[key] = overrideObject[key];
            }
        });
    }
    return baseObject;
};

//#- `vis.drawHighChartsTimeSeries(data, fnm, overrideParam)` -- generates a html file `fnm` (file name) with a visualization of  `data` (highcharts JSON), based on plot parameters `overrideParam` (JSON) 
exports.drawHighChartsTimeSeries = function (data, fnm, overrideParams) {
    // read template html. Fill in data, overrideParams, containerName, code and libraries

    var template = fs.openRead(process.qminer_home + "gui/visualization_templates/highCharts_ts.html").readAll();

    // data, plot parameters and libraries to be filled in the template

    var libPathArray = [
        process.qminer_home + "gui/js/Highcharts/js/highcharts.js",
        process.qminer_home + "gui/js/Highcharts/js/modules/exporting.js",
        process.qminer_home + "lib/visualization.js"
    ];
    // TODO mustache :)
    var output = template.replace("{{{data}}}", JSON.stringify(data)).replace("{{{overrideParams}}}", JSON.stringify(overrideParams)).replace("{{{libs}}}", glueFileContents(libPathArray));
    fs.openWrite(fnm).write(output).close();
};

//#- `vis.drawHighChartsTimeSeries(data, fnm, overrideParam)` -- generates a html file `fnm` (file name) with a visualization of  `data` (highcharts JSON), based on plot parameters `overrideParam` (JSON) 
exports.drawHighChartsTimeSeries2 = function (data, fnm, overrideParams) {
    // read template html. Fill in data, overrideParams, containerName, code and libraries
    var template = "";
    if (!fs.exists(fnm)) {
        //var template = fs.openRead(process.qminer_home + "gui/visualization_templates/highCharts_ts.html").readAll();
        template = fs.openRead(process.qminer_home + "gui/visualization_templates/highCharts_ts2.html").readAll();
        // data, plot parameters and libraries to be filled in the template

        var libPathArray = [
            process.qminer_home + "gui/js/Highcharts/js/highcharts.js",
            process.qminer_home + "gui/js/Highcharts/js/modules/exporting.js",
            process.qminer_home + "lib/visualization.js"
        ];
        template = template.replace("{{{libs}}}", glueFileContents(libPathArray));
    } else {
        template = fs.openRead(fnm).readAll();
    }
    // TODO mustache :)
    var output = template.replace("{{{data}}}", JSON.stringify(data)).replace("{{{overrideParams}}}", JSON.stringify(overrideParams))
    fs.openWrite(fnm).write(output).close();
};


//#- `vis.makeHighChartsTemplate(numOfCharts)` -- generates a html file `fnm` (file name) template to be fielled with data` (highcharts JSON) and plot parameters `overrideParam` (JSON) 
exports.makeHighChartsTemplate = function (fnm, numOfCharts) {

    var makeHeadContent = "$(function () { var data = {{{data}}}; var overrideParams = {{{overrideParams}}}; visualize.highChartsPlot(data, overrideParams, \"{{{graphId}}}\"); });\n";

    // TODO: parameters in this style could be input variables. Imagine if we want to create 2 graphs in the same horizontal line.
    var makeGraphContent = "<div id=\"{{{graphId}}}\" style=\"min-width: 310px; height: 400px; margin: 0 auto\"></div><br/>\n";

    // Creates head contents with makeHeadContent
    var createPageHead = function (ids) {
        var content = "";
        for (id in ids) {
            content += makeHeadContent.replace('{{{graphId}}}', ids[id]);
        }
        return content;
    }

    // Creates graph contents with makeGraphContent
    var createGraphContent = function (ids) {
        var content = "";
        for (id in ids) {
            content += makeGraphContent.replace('{{{graphId}}}', ids[id]);
        }
        return content;
    }

    // Libraries to be filled in the template
    var libPathArray = [
        process.qminer_home + "gui/js/Highcharts/js/highcharts.js",
        process.qminer_home + "gui/js/Highcharts/js/modules/exporting.js",
        process.qminer_home + "lib/visualization.js"
    ];

    // Create graph variables
    var graphVars = [];
    for (var i = 1; i <= numOfCharts; i++) {
        var graph = "graph" + i;
        graphVars.push(graph);
    }

    // create final template content
    //var template = mainPageTemplate.replace("{{{head}}}", createPageHead(graphVars)).replace("{{{graph}}}", createGraphContent(graphVars)).replace("{{{libs}}}", glueFileContents(libPathArray));
    //var template = mainPageTemplate;
    template = fs.openRead(process.qminer_home + "gui/visualization_templates/highCharts_ts_array.html").readAll();
    template = template.replace("{{{libs}}}", glueFileContents(libPathArray));
    template = template.replace("{{{head}}}", createPageHead(graphVars))
    template = template.replace("{{{graph}}}", createGraphContent(graphVars))

    // create html template file
    if (fs.exists(fnm)) {
        fs.del(fnm);
    }
    fs.openWrite(fnm).write(template).close();
}


//#- `vis.drawHighChartsTimeSeries(data, fnm, overrideParam)` -- generates a html file `fnm` (file name) with a visualization of  `data` (highcharts JSON), based on plot parameters `overrideParam` (JSON) 
exports.drawMultipleHighChartsTimeSeries = function (data, fnm, overrideParams) {
    // Check if filename exists
    if (!fs.exists(fnm)) {
        console.log("Warning", "File" + fnm + " doesent exist. Use exports.makeHighChartsTemplate(fnm, numOfCharts) first.")
    }
    // TODO mustache :)
    // read template html. Fill in data, overrideParams, containerName, code and libraries
    var template = fs.openRead(fnm).readAll();
    var output = template.replace("{{{data}}}", JSON.stringify(data)).replace("{{{overrideParams}}}", JSON.stringify(overrideParams))
    fs.openWrite(fnm).write(output).close();
};

exports.highChartsPlot = function (data, overrideParams, containerName) {
    var params = exports.highchartsParams();
    if (typeof overrideParams != 'undefined') {
        params = overwriteKeys(params, overrideParams, false);
    }
    params.series = data;
    $(function () {
        $('#' + containerName).highcharts(params);
    });
};

exports.googleAnnotatedTimeLine = function (data, overrideParams, containerName) {
    var table = new google.visualization.DataTable();
    table.addColumn('date', 'Time');
    table.addColumn('number', 'Val');
    table.addRows(data);

    var params = exports.googleAnnotatedTimeLineParams();
    if (typeof overrideParams != 'undefined') {
        params = overwriteKeys(params, overrideParams, false);
    }

    var chart = new google.visualization.AnnotatedTimeLine(document.getElementById(containerName));
    chart.draw(table, params);
};

//#- `vis.drawGoogleAnnotatedTimeLine(data, fnm, overrideParam)` -- generates a html file `fnm` (file name) with a visualization of  `data` (google time line JSON), based on plot parameters `overrideParam` (JSON) 
exports.drawGoogleAnnotatedTimeLine = function (data, fnm, overrideParams) {
    // read template html. Fill in data, overrideParams, containerName, code and libraries

    var template = fs.openRead(process.qminer_home + "gui/visualization_templates/googleAnnotatedTimeLine.html").readAll();
    // data, plot parameters and libraries to be filled in the template

    var libPathArray = [
        process.qminer_home + "lib/visualization.js"
    ];
    // TODO mustache :)
    var output = template.replace("{{{data}}}", JSON.stringify(data)).replace("{{{overrideParams}}}", JSON.stringify(overrideParams)).replace("{{{libs}}}", glueFileContents(libPathArray));
    fs.openWrite(fnm).write(output).close();
};

exports.convertDates = function (dataJSON) {
    var data = [];
    for (var i = 0; i < dataJSON.length; i++) {
        data[i] = [new Date(dataJSON[i][0]), dataJSON[i][1]];
    }
    return data;
};

//#- `vis.drawCommunityEvolution(data, fnm, overrideParam)` -- generates a html file `fnm` (file name) with a visualization of  `data` (communityEvolution JSON), based on plot parameters `overrideParam` (JSON) 
exports.drawCommunityEvolution = function (data, fnm, overrideParams) {
    // read template html. Fill in data, overrideParams, containerName, code and libraries

    var template = fs.openRead(process.qminer_home + "gui/visualization_templates/communityEvolution.html").readAll();
    // data, plot parameters and libraries to be filled in the template
    // TODO mustache :)
    var output = template.replace("{{{data}}}", data);
    fs.openWrite(fnm).write(output).close();
};

//#- `vis.drawCommunityEvolution(data, fnm, overrideParam)` -- generates a html file `fnm` (file name) with a visualization of  `data` (communityEvolution JSON), based on plot parameters `overrideParam` (JSON) 
exports.drawGraph = function (graph, fnm, opts) {
    // read template html. Fill in data, overrideParams, containerName, code and libraries
    var json_out = snap.trainRecGraph(graph, opts);

    var template = fs.openRead(process.qminer_home + "gui/visualization_templates/graphDraw.html").readAll();
    // data, plot parameters and libraries to be filled in the template
    // TODO mustache :)
    var output = template.replace("{{{data}}}", JSON.stringify(json_out));
    fs.openWrite(fnm).write(output).close();
};

//#- `vis.drawCommunityEvolution(data, fnm, overrideParam)` -- generates a html file `fnm` (file name) with a visualization of  `data` (communityEvolution JSON), based on plot parameters `overrideParam` (JSON) 
exports.drawGraphArray = function (data, fnm, overrideParams) {
    // read template html. Fill in data, overrideParams, containerName, code and libraries
    var json_out = snap.trainRecGraphArray(data);
    var template = fs.openRead(process.qminer_home + "gui/visualization_templates/graphArrayDraw.html").readAll();
    // data, plot parameters and libraries to be filled in the template
    // TODO mustache :)
    var output = template.replace("{{{data}}}", JSON.stringify(json_out));
    fs.openWrite(fnm).write(output).close();
};
    
var visualize = exports;