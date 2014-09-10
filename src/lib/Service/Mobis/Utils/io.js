//function printStr(vec) {
vecToStr = function (vec) {
	var outStr =  "";
	for (var ii=0; ii<vec.length-1; ii++) {
		outStr += vec.at(ii).toString()+" ";
	}
	outStr += vec.at(vec.length-1);
	return outStr;
};
exports.vecToStr = function (vec) {
    return vecToStr(vec);
};


saveToFile = function (filename) {
    var fileName = filename;
    if (fs.exists(fileName)) {
        fs.del(fileName);
    }

    this.saveToFile = function (ftrVec, target) {
        //target variable is optional
        if (target != null) {
            ftrVec.push(target);
        }
        //ftrVec.print();
        fout = fs.openAppend(fileName);
        fout.writeLine(vecToStr(ftrVec));
        fout.flush();
        fout.close();
    }
}
exports.newSaveToFile = function (filename) {
    return new saveToFile(filename)
}

loadVec = function (fin) {
    var line = fin.readLine();
    var numArray = line.split(" ").map(function (i) {
        return parseFloat(i);
    });
    return la.newVec(numArray);
}
exports.loadVec = function (fin) {
    return loadVec(fin);
};

loadMat = function (fin) {
    var nestedArray = [];
    while (!fin.eof) {
        var line = fin.readLine();
        var numArray = line.split(" ").map(function (i) {
            return parseFloat(i);
        });
        nestedArray.push(numArray);
    }
    return la.newMat(nestedArray);
}
exports.loadMat = function (fin) {
    return loadMat(fin);
};


// About this module
exports.about = function() {
	var description = "Some helpful input output functions.";
	return description;
};