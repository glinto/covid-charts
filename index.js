"use strict";

const { resolve } = require('path');

var $covidChartsNamespace = function() {

	var imports = {
		express: require('express'),
		http: require('http'),
		path: require('path'),
		fetch: require('node-fetch')
	};

	var httpApp;
	var httpServer;
	var data = {labels: {}, cases: {}, newCases: {}, deaths: {}, deathRates: {}};
	var lastDataAt = 0;

	function init() {

		httpApp = imports.express();
		httpServer = new imports.http.Server(httpApp);

		

		httpApp.use(imports.express.static(imports.path.join(__dirname, './static')));

		httpApp.get('/data', function (req, res) {
			res.setHeader('Content-Type', 'application/json');
			res.json(data);
		});
		
		loadData().then(() => {
			httpServer.listen(3080, () => {
				console.log(`Server listening on port ${3080}`);
				setInterval(() => {
						loadData();
					}, 3600 * 4 * 1000);
			});
		});
		
	}

	function loadData() {
		return new Promise((resolve) => {
		console.log('Fetching cases...')
		imports.fetch('https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv')
			.then(res => res.text())
			.then(txt => {
				console.log("Processing cases...")
				return processCases(txt);	
			})
			.then(() => {
				console.log("Fetching deaths...");
				return imports.fetch('https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv');
			})
			.then(res => res.text())
			.then(txt => {
				console.log("Processing deaths...")
				return processDeaths(txt);
			})
			.then(() => { resolve(); });
		});
	}

	function processCases(txt) {
		var dataCases = {};
		var newCases = {};
		var rows = txt.split('\n');
		var labels = rows[0].split(',').slice(43); 

		return new Promise((resolve) => {

			dataCases = aggregateCountries(rows);
			var country;
			for (country in dataCases) {
				var increments = [];
				var previous = 0;
				var totalIncrement = 0;
				newCases[country] = dataCases[country].map((value, index) => {
					var increment = value - previous;
					previous = value;
					increments.push(increment);
					totalIncrement += increment;
					if (increments.length > 7) totalIncrement -= increments.shift();
					return Math.round(totalIncrement / increments.length);
				});
			}
			data.cases = dataCases;
			data.newCases = newCases;
			data.labels = labels;
			resolve();
		});

		//console.log(newCases.Hungary);
		//console.log(data.labels);
	}

	function processDeaths(txt) {
		return new Promise((resolve) => {

		var rows = txt.split('\n');
		var deaths = aggregateCountries(rows);
		for (var country in deaths) {
			if (data.cases[country]) data.deathRates[country] = deaths[country].map((value, index) => {
				return value / data.cases[country][index];
			});
		}
		resolve();
		});
	}

	function aggregateCountries(rows) {
		var result = {};
		rows.forEach((row, index) => {
			var cols = row.split(',');
			
			var country = cols[1];
			//Country
			if (!result[country]) {
				//add country from Mar 1
				result[country] = cols.slice(43).map(value => parseInt(value));
			}
			else {
				//country has multiple rows add it to existing
				cols.slice(43).forEach((col, index) => {
					result[country][index] = parseInt(result[country][index]) + parseInt(col);
				});
			}
		});
		return result;
	}

	return {
		init: init
	};
}();

$covidChartsNamespace.init();	
