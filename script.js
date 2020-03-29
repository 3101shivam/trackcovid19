// Declare constants
const loadingTime = 1000;
const tickDuration = 400;
const top_n = 20;

const height = 600;
const width = 960;

const labelScale = 15 / top_n > 1 ? 1 : 15 / top_n;

const margin = {
	top: 60,
	right: 0,
	bottom: 5,
	left: 125
};

const barPadding = (height - (margin.bottom + margin.top)) / (top_n * 5);

const flag = {
	offsetx: 0,
	offsety: 5,
};

const map = {
	width: 960,
	height: 550,
	circlemin: 5,
	circlemax: 20
};

const labelbg = {
	offsetx: -margin.left,
	offsety: -labelScale * 6,
	height: labelScale * 20,
	width: margin.left
};

const label = {
	offsetx: 5,
	offsety: labelScale * 8
};

const colourScale = d3.scaleOrdinal(d3.schemeTableau10)
.domain(["Asia", "Europe", "Americas", "Oceania", "Africa", "China"]);	

// Declare global variables used everywhere
var data = undefined;
var tooltip = undefined;
var day = undefined;
var startDay = undefined;
var endDay = undefined;
var worlddata = undefined;
var daySlice = undefined;
var x = undefined;
var y = undefined;
var projection = undefined;
var groupsFilter = ["Asia", "Americas", "Oceania", "Europe", "Africa"];
var animating = true;
var revert = false;
var sortOrder = 'cases';
var startDate = moment('2020-01-22');
var tooltipVar = {
	country: undefined,
	left: 0,
	top: 0
}
var sliderDay = undefined;
var playButton = d3.select("#play-button");;

d3.csv('merged.csv')
.then(function(csvdata) {
	data = csvdata;

	d3.json('ne_10m_simplified.json')
	.then(function(jsonworlddata) {

		worlddata = jsonworlddata;

		data.forEach(d => {
			d.cases = +d.Cases,
			d.lastcases = +d.LastCases,
			d.deaths = +d.Deaths,
			d.recovered = +d.Recovered,
			d.day = +d.Day
		});

		let startDayFilter = data.filter(d => d.cases > 0 && groupsFilter.includes(d.Group));
		startDay = d3.min(startDayFilter, function(d) {
			return +d.Day;
		});
		endDay = d3.max(data, function(d) {
			return +d.Day;
		});
		day = startDay;

		daySlice = data.filter(d =>
			d.day == day &&
			!isNaN(d.cases) &&
			d.cases > 0 &&
			groupsFilter.includes(d.Group)
			)
		.sort(function(a, b) {
			if (sortOrder == 'cases')
			{
				return b.cases - a.cases || b.deaths - a.deaths || b.recovered - a.recovered;
			}
			else if (sortOrder == 'deaths') {
				return b.deaths - a.deaths || b.cases - a.cases || b.recovered - a.recovered;
			}
			else {
				return b.recovered - a.recovered || b.cases - a.cases || b.deaths - a.deaths;
			}
		})
		.slice(0, top_n);

		daySlice.forEach((d, i) => d.rank = i);

		x = d3.scaleLinear()
		.domain([0, d3.max(daySlice, d => d.cases)])
		.range([margin.left, width - margin.right - 65]);

		y = d3.scaleLinear()
		.domain([top_n, 0])
		.range([height - margin.bottom, margin.top]);

		flag.offsetx = -(y(1) - y(0) - barPadding + 2);

		let groups = data.map(d => d.Group);
		groups = [...new Set(groups)];

		let subTitle = svg.append('text')
		.attrs({
			class: 'subTitle',
			y: 30,
			x: margin.left
		})
		.html('No. of Reported Cases (Bars), Deaths (Dark), Recovered (Light) for Top 20 Countries coloured by Regions');

		let xAxis = d3.axisTop()
		.scale(x)
		.ticks(width > 500 ? 5 : 2)
		.tickSize(-(height - margin.top - margin.bottom))
		.tickFormat(d => d3.format(',')(d));

		tooltip = d3.select("body").append("div")
		.attr("class", "tooltip")
		.styles({
			"display": "none",
			"opacity": .9
		});

		svg.append('g')
		.attrs({
			class: 'axis xAxis',
			transform: `translate(0, ${margin.top})`
		})
		.call(xAxis)
		.selectAll('.tick line')
		.classed('origin', d => d == 0);

		svg.selectAll('rect.bar.cases')
		.data(daySlice, d => d.Country)
		.enter()
		.append('rect')
		.attrs({
			class: d => `bar cases ${d.Country.replace(/\s/g,'_')}`,
			x: d => margin.left + 1,
			width: d => getX(x, d.cases) - margin.left - 1,
			y: d => y(d.rank) + 5,
			height: y(1) - y(0) - barPadding
		})
		.styles({
			fill: d => colourScale(d.Group)
		});

		svg.selectAll('rect.bar.deaths')
		.data(daySlice, d => d.Country)
		.enter()
		.append('rect')
		.attrs({
			class: d => `bar deaths ${d.Country.replace(/\s/g,'_')}`,
			x: d => margin.left + 1 + (sortOrder == 'recovered' ? ((getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1)) : 0),
			width: d => (getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1),
			y: d => y(d.rank) + 5,
			height: y(1) - y(0) - barPadding
		})
		.styles({
			fill: 'black',
			'fill-opacity': 0.5
		});

		svg.selectAll('rect.bar.recovered')
		.data(daySlice, d => d.Country)
		.enter()
		.append('rect')
		.attrs({
			class: d => `bar recovered ${d.Country.replace(/\s/g,'_')}`,
			x: d => margin.left + 1 + (sortOrder != 'recovered' ? ((getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1)) : 0),
			width: d => (getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1),
			y: d => y(d.rank) + 5,
			height: y(1) - y(0) - barPadding
		})
		.styles({
			fill: 'white',
			'fill-opacity': 0.5
		});

		svg.selectAll('image.flag')
		.data(daySlice, d => d.Country)
		.enter()
		.append('image')
		.attrs({
			class: 'flag',
			transform: d => `translate(${getX(x,d.cases)+flag.offsetx}, ${y(d.rank)+flag.offsety})`,
			height: y(1) - y(0) - barPadding,
			width: y(1) - y(0) - barPadding,
			'xlink:href': d => d.Flag
		});

		svg.selectAll('rect.background')
		.data(daySlice, d => d.Country)
		.enter()
		.append('rect')
		.attrs({
			class: 'background',
			transform: d => `translate(${margin.left+labelbg.offsetx}, ${y(d.rank)+((y(1)-y(0))/2)+labelbg.offsety})`,
			width: labelbg.width,
			height: labelbg.height
		})
		.styles({
			fill: "white"
		});

		svg.selectAll('text.label')
		.data(daySlice, d => d.Country)
		.enter()
		.append('text')
		.attrs({
			class: 'label',
			transform: d => `translate(${margin.left-5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`,
			'text-anchor': 'end'
		})
		.text(d => d.Country);

		svg.selectAll('text.valueLabel')
		.data(daySlice, d => d.Country)
		.enter()
		.append('text')
		.attrs({
			class: 'valueLabel',
			transform: d => `translate(${getX(x,d.cases) + 5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`,
		})
		.text(d => d3.format(',')(d.cases));

		let sortText = svg.append('text')
		.attrs({
			class: 'sortText',
			x: 5,
			y: 30
		})
		.styles({
			'text-anchor': 'begin',
			'font-size': '14px'
		})
		.text('Sort: Cases')
		.on("click", function(d) {
			if (sortOrder == 'cases') {
				d3.select(this).text('Sort: Deaths');
				sortOrder = 'deaths';
			}
			else if (sortOrder == 'deaths') {
				d3.select(this).text('Sort: Recovered');
				sortOrder = 'recovered';
			}
			else {
				d3.select(this).text('Sort: Cases');
				sortOrder = 'cases';
			}
		});

		let dayText = svg.append('text')
		.attrs({
			class: 'dayText',
			x: width - 10,
			y: height - 85
		})
		.styles({
			'text-anchor': 'end'
		})
		.html(startDate.clone().add(day, 'day').format('D MMM'));

		totalDay = d3.sum(daySlice, function(d) {
			return d.cases
		})

		let totalText = svg.append('text')
		.attrs({
			class: 'totalText',
			x: width - 10,
			y: height - 20
		})
		.styles({
			'text-anchor': 'end'
		})
		.html('Total: ' + d3.format(',')(totalDay));

		createSlider();
		createMap();
		drawTable();
		setEvents();

		d3.timeout(_ => {

			let ticker = d3.interval(e => {
				daySlice = data.filter(d =>
					d.day == day &&
					!isNaN(d.cases) &&
					d.cases > 0 &&
					groupsFilter.includes(d.Group)
					)
				.sort(function(a, b) {
					if (sortOrder == 'cases')
					{
						return b.cases - a.cases || b.deaths - a.deaths || b.recovered - a.recovered;
					}
					else if (sortOrder == 'deaths') {
						return b.deaths - a.deaths || b.cases - a.cases || b.recovered - a.recovered;
					}
					else {
						return b.recovered - a.recovered || b.cases - a.cases || b.deaths - a.deaths;
					}
				})
				.slice(0, top_n);

				daySlice.forEach((d, i) => d.rank = i);

				x.domain([0, d3.max(daySlice, d => d.cases)]);

				svg.select('.xAxis')
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.call(xAxis);

				let casebars = svg.selectAll('.bar.cases').data(daySlice, d => d.Country);
				let deathbars = svg.selectAll('.bar.deaths').data(daySlice, d => d.Country);
				let recoveredbars = svg.selectAll('.bar.recovered').data(daySlice, d => d.Country);

				casebars
				.enter()
				.append('rect')
				.attrs({
					class: d => `bar cases ${d.Country.replace(/\s/g,'_')}`,
					x: d => margin.left + 1,
					width: d => (getX(x, d.cases) - margin.left) - 1 < 0 ? 0 : (getX(x, d.cases) - margin.left - 1),
					y: d => y(top_n + 1) + 5,
					height: y(1) - y(0) - barPadding
				})
				.styles({
					fill: d => colourScale(d.Group)
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					y: d => y(d.rank) + 5
				});

				casebars
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					x: d => margin.left + 1,
					width: d => (getX(x, d.cases) - margin.left) - 1 < 0 ? 0 : (getX(x, d.cases) - margin.left - 1),
					y: d => y(d.rank) + 5
				});

				casebars
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					x: d => margin.left + 1,
					width: d => (getX(x, d.cases) - margin.left - 1) < 0 ? 0 : (getX(x, d.cases) - margin.left - 1),
					y: d => y(top_n + 1) + 5
				})
				.remove();

				deathbars
				.enter()
				.append('rect')
				.attrs({
					class: d => `bar deaths ${d.Country.replace(/\s/g,'_')}`,
					x: d => margin.left + 1 + (sortOrder == 'recovered' ? ((getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1)) : 0),
					width: d => (getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1),
					y: d => y(top_n + 1) + 5,
					height: y(1) - y(0) - barPadding
				})
				.styles({
					'fill': 'black',
					'fill-opacity': 0.5
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					y: d => y(d.rank) + 5
				});

				deathbars
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					x: d => margin.left + 1 + (sortOrder == 'recovered' ? ((getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1)) : 0),
					width: d => (getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1),
					y: d => y(d.rank) + 5
				});

				deathbars
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					x: d => margin.left + 1 + (sortOrder == 'recovered' ? ((getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1)) : 0),
					width: d => (getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1),
					y: d => y(top_n + 1) + 5
				})
				.remove();

				recoveredbars
				.enter()
				.append('rect')
				.attrs({
					class: d => `bar recovered ${d.Country.replace(/\s/g,'_')}`,
					x: d => margin.left + 1 + (sortOrder != 'recovered' ? ((getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1)) : 0),
					width: d => (getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1),
					y: d => y(top_n + 1) + 5,
					height: y(1) - y(0) - barPadding
				})
				.styles({
					'fill': 'white',
					'fill-opacity': 0.5
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					y: d => y(d.rank) + 5
				});

				recoveredbars
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					x: d => margin.left + 1 + (sortOrder != 'recovered' ? ((getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1)) : 0),
					width: d => (getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1),
					y: d => y(d.rank) + 5
				});

				recoveredbars
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					x: d => margin.left + 1 + (sortOrder != 'recovered' ? ((getX(x, d.deaths) - margin.left - 1) < 0 ? 0 : (getX(x, d.deaths) - margin.left - 1)) : 0),
					width: d => (getX(x, d.recovered) - margin.left - 1) < 0 ? 0 : (getX(x, d.recovered) - margin.left - 1),
					y: d => y(top_n + 1) + 5
				})
				.remove();

				let flags = svg.selectAll('.flag').data(daySlice, d => d.Country);

				flags
				.enter()
				.append('image')
				.attrs({
					class: 'flag',
					transform: d => `translate(${getX(x,d.cases)+flag.offsetx}, ${y(top_n+1)+flag.offsety})`,
					'xlink:href': d => d.Flag,
					height: y(1) - y(0) - barPadding,
					width: y(1) - y(0) - barPadding
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${getX(x,d.cases)+flag.offsetx}, ${y(d.rank)+flag.offsety})`
				});

				flags
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${getX(x,d.cases)+flag.offsetx}, ${y(d.rank)+flag.offsety})`
				});

				flags
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${getX(x,d.cases)+flag.offsetx}, ${y(top_n+1)+flag.offsety})`
				})
				.remove();

				let backgrounds = svg.selectAll('.background').data(daySlice, d => d.Country);

				backgrounds
				.enter()
				.append('rect')
				.attrs({
					class: 'background',
					transform: d => `translate(${margin.left+labelbg.offsetx}, ${y(top_n+1)+((y(1)-y(0))/2)+labelbg.offsety})`,
					height: labelbg.height,
					width: labelbg.width
				})
				.styles({
					fill: "white"
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${margin.left+labelbg.offsetx}, ${y(d.rank)+((y(1)-y(0))/2)+labelbg.offsety})`,
				})
				.styles({
					fill: "white"
				});

				backgrounds
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${margin.left+labelbg.offsetx}, ${y(d.rank)+((y(1)-y(0))/2)+labelbg.offsety})`,
				})
				.styles({
					fill: "white"
				});

				backgrounds
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${margin.left+labelbg.offsetx}, ${y(top_n+1)+((y(1)-y(0))/2)+labelbg.offsety})`,
				})
				.styles({
					fill: "white"
				})
				.remove();

				let labels = svg.selectAll('.label').data(daySlice, d => d.Country);

				labels
				.enter()
				.append('text')
				.attrs({
					class: 'label',
					transform: d => `translate(${margin.left-5}, ${y(top_n+1)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`,
					'text-anchor': 'end'
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${margin.left-5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`
				})
				.text(d => d.Country);

				labels
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${margin.left-5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`
				});

				labels
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${margin.left-5}, ${y(top_n+1)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`
				})
				.remove();

				let valueLabels = svg.selectAll('.valueLabel').data(daySlice, d => d.Country);

				valueLabels
				.enter()
				.append('text')
				.attrs({
					class: 'valueLabel',
					transform: d => `translate(${getX(x,d.cases) + 5}, ${y(top_n+1)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`
				})
				.text(d => d3.format(',.0f')(d.lastcases))
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${getX(x,d.cases) + 5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`
				});

				valueLabels
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${getX(x,d.cases) + 5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`,
				})
				.tween("text", function(d) {
					let startValue = d.lastcases;
					if (day == startDay + 1) startValue = d.cases;
					let i = d3.interpolateRound(startValue, d.cases);
					return function(t) {
						this.textContent = d3.format(',')(i(t));
					};
				});

				valueLabels
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					transform: d => `translate(${getX(x,d.cases) + 5}, ${y(top_n+1)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`,
				})
				.remove();

				let countryMarkers = svg2.select('.map-legend').selectAll('.countryMarker').data(daySlice, d => d.Country);

				countryMarkers
				.enter()
				.append('circle')
				.attrs({
					class: 'countryMarker',
					cx: d => projection([d.Lon, d.Lat])[0],
					cy: d => projection([d.Lon, d.Lat])[1],
					r: 0
				})
				.styles({
					stroke: '#000000',
					fill: 'none'
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					r: d => d.cases / x.domain()[1] * (map.circlemax - map.circlemin) + map.circlemin
				})
				.styles({
					stroke: 'darkred',
					fill: 'red'
				});

				countryMarkers
				.styles({
					stroke: '#666666',
					fill: '#000000',
					'fill-opacity': 0.3
				})
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					r: d => d.cases / x.domain()[1] * (map.circlemax - map.circlemin) + map.circlemin
				});

				countryMarkers
				.exit()
				.transition()
				.duration(tickDuration)
				.ease(d3.easeLinear)
				.attrs({
					r: 0
				})
				.remove();

				dayText.html(startDate.clone().add(day, 'day').format('D MMM'));

				previousDay = totalDay;
				totalDay = d3.sum(daySlice, function(d) {
					return d.cases
				});

				totalText
				.transition()
				.duration(tickDuration)
				.tween("text", function(d) {
					let i = d3.interpolateRound(previousDay, totalDay);
					return function(t) {
						this.textContent = 'Total: ' + d3.format(',')(i(t));
					};
				});

				if (day >= endDay) {
					day = endDay;
					animating = false;
				}

				if (animating) {
					day = day + 1;

					valueLabels
					.transition()
					.duration(tickDuration)
					.ease(d3.easeLinear)
					.attrs({
						transform: d => `translate(${getX(x,d.cases) + 5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`,
					})
					.tween("text", function(d) {
						let startValue = d.lastcases;
						if (day == startDay + 1) startValue = d.cases;
						let i = d3.interpolateRound(startValue, d.cases);
						return function(t) {
							this.textContent = d3.format(',')(i(t));
						};
					});

					playButton.text("Pause");

				} else {

					valueLabels
					.transition()
					.duration(tickDuration)
					.ease(d3.easeLinear)
					.attrs({
						transform: d => `translate(${getX(x,d.cases) + 5}, ${y(d.rank)+((y(1)-y(0))/2)+label.offsety}) scale(${labelScale},${labelScale})`,
					})
					.text(d => d3.format(',.0f')(d.cases));

					if (day == endDay) {
						playButton.text("Restart");
					} else {
						playButton.text("Play");
					}

				}
				sliderDay.value(day);

				drawTooltip();
				drawTable();

				setEvents();

			}, tickDuration);

}, loadingTime);

});
});

// Create charts and tables
var svg = d3.select("#chartArea")
.append('svg')
.attrs({
	viewBox: '0 0 960 600',
	width: '100%',
	preserveAspectRatio: 'xMidYMin meet'
})
.style('border', '1px solid #dddddd');

var svg2 = d3.select("#mapArea")
.append('svg')
.attrs({
	viewBox: '0 0 960 500',
	width: '100%',
	preserveAspectRatio: 'xMidYMin meet'
})
.style('border', '1px solid #dddddd');

var dataTable = d3.select("#dataTable")
.append('table')
.attr('class', 'table');

var dataTableHeader = dataTable.append('thead').append('tr');
dataTableHeader
.selectAll('th')
.data(["Region", "Cases", "Deaths", "Recovered"])
.enter()
.append("th")
.text(function(d) {
	return d;
});

// Define functions
function getX(scale, label) {
	return isNaN(scale(label)) ? 0 : scale(label);
}

function drawTooltip() {
	if (tooltipVar.country != undefined) {
		let tooltipFilter = data.filter(d => d.day == day && d.Country == tooltipVar.country);
		tooltip
		.data(tooltipFilter)
		.transition()
		.duration(200)
		.style("display", null);
		tooltip.html(d => "<b>" + d.Country + "</b><br/>" +
			"<b>Cases</b>: " + d3.format(',.0f')(d.cases) + "<br/>" +
			"<b>Deaths</b>: " + d3.format(',.0f')(d.deaths) + " (" + d3.format(',.2%')(d.deaths / d.cases) + ")<br/>" +
			"<b>Recovered</b>: " + d3.format(',.0f')(d.recovered) + " (" + d3.format(',.2%')(d.recovered / d.cases) + ")<br/>"
			)
		.style("left", tooltipVar.left)
		.style("top", tooltipVar.top);
	} else {
		tooltip.transition()
		.duration(500)
		.style("display", "none");
	}
}

function drawTable() {
	dataTableData = data.filter(d => d.day == day &&
		d.cases > 0)

	var groupedData = d3.nest()
	.key(function(d) {
		return d.Group;
	})
	.rollup(function(v) {
		return {
			cases: d3.sum(v, function(d) {
				return d.cases;
			}),
			deaths: d3.sum(v, function(d) {
				return d.deaths;
			}),
			recovered: d3.sum(v, function(d) {
				return d.recovered;
			})
		};
	})
	.entries(dataTableData)
	.sort(function(a, b) {
		if (sortOrder == 'cases')
		{
			return b.value.cases - a.value.cases || b.value.deaths - a.value.deaths || b.value.recovered - a.value.recovered;
		}
		else if (sortOrder == 'deaths') {
			return b.value.deaths - a.value.deaths || b.value.cases - a.value.cases || b.value.recovered - a.value.recovered;
		}
		else {
			return b.value.recovered - a.value.recovered || b.value.cases - a.value.cases || b.value.deaths - a.value.deaths;
		}
	});

	var tds = [];
	var totals = {}
	totals['Region'] = 'Total';
	totals['Cases'] = 0;
	totals['Deaths'] = 0;
	totals['Recovered'] = 0;
	groupedData.forEach(function(d) {
		var innerTd = {};
		innerTd['Region'] = d.key;
		innerTd['Cases'] = d3.format(',.0f')(d.value.cases);
		innerTd['Deaths'] = d3.format(',.0f')(d.value.deaths);
		innerTd['Recovered'] = d3.format(',.0f')(d.value.recovered);
		totals['Cases'] += d.value.cases;
		totals['Deaths'] += d.value.deaths;
		totals['Recovered'] += d.value.recovered;
		tds.push(innerTd);
	});
	totals['Cases'] = d3.format(',.0f')(totals['Cases']);
	totals['Deaths'] = d3.format(',.0f')(totals['Deaths']);
	totals['Recovered'] = d3.format(',.0f')(totals['Recovered']);
	tds.push(totals);

	dataTable.selectAll("tbody").remove();
	var dataTableBody = dataTable.append('tbody');
	var rows = dataTableBody.
	selectAll("tr")
	.data(tds)
	.enter()
	.append("tr")
	.style("font-weight", d => d.Region === "Total" ? 'bold' : '')
	.style("color", d => groupsFilter.includes(d.Region) || d.Region === "Total" ? '#000000' : '#cccccc')
	.on("click", function(d) {
		if (d.Region != "Total") {
			if (groupsFilter.includes(d.Region)) {
				groupsFilter.splice(groupsFilter.indexOf(d.Region), 1);
				svg2.selectAll('.legend.' + d.Region.toLowerCase()).attr('fill-opacity', 0.25);
			} else {
				groupsFilter.push(d.Region);
				svg2.selectAll('.legend.' + d.Region.toLowerCase()).attr('fill-opacity', 1);
			}
		}
	});

	var cells = rows
	.selectAll("td")
	.data(function(row) {
		return ["Region", "Cases", "Deaths", "Recovered"].map(function(column) {
			return {
				column: column,
				value: row[column]
			};
		});
	})
	.enter()
	.append("td")
	.html(d => d.value);
}

function createMap() {
	let word_simplified = topojson.presimplify(worlddata);
	let min_weight = topojson.quantile(word_simplified, 0.3);
	word_simplified = topojson.simplify(word_simplified, min_weight);
	let land2 = word_simplified;
	world_simplified = land2;

	let land = topojson.feature(world_simplified, {
		type: 'GeometryCollection',
		geometries: world_simplified.objects.ne_10m_admin_0_countries.geometries.filter(d => ['Antarctica', 'Greenland'].includes(d.properties.ADMIN))
	});

	projection = d3.geoNaturalEarth1()
	.fitSize([map.width, map.height - 50], land);

	let regions = world_simplified.objects.ne_10m_admin_0_countries.geometries.map(d => d.properties.REGION_UN);
	regions = [...new Set(regions)];

	const path = d3.geoPath()
	.projection(projection);

	let mapLegend = svg2.append('g')
	.attrs({
		class: 'map-legend big',
		transform: `translate(0, 60)`
	});

	let mapSubtitle = mapLegend
	.append('text')
	.attrs({
		x: 5,
		y: -25
	})
	.html('Click region to toggle. China is excluded on load.');

	mapLegend
	.append('path')
	.attr('class', 'legend asia')
	.datum(topojson.merge(world_simplified, world_simplified.objects.ne_10m_admin_0_countries.geometries.filter(d => d.properties.REGION_UN == 'Asia' && d.properties.ADMIN != 'China')))
	.attrs({
		'd': path,
		'fill': colourScale('Asia')
	})
	.on("click", function() {
		if (groupsFilter.includes('Asia')) {
			groupsFilter.splice(groupsFilter.indexOf('Asia'), 1);
			d3.select(this).attr('fill-opacity', 0.25);
		} else {
			groupsFilter.push('Asia');
			d3.select(this).attr('fill-opacity', 1);
		}
	});

	mapLegend
	.append('path')
	.attr('class', 'legend europe')
	.datum(topojson.merge(world_simplified, world_simplified.objects.ne_10m_admin_0_countries.geometries.filter(d => d.properties.REGION_UN == 'Europe')))
	.attrs({
		'd': path,
		'fill': colourScale('Europe')
	})
	.on("click", function() {
		if (groupsFilter.includes('Europe')) {
			groupsFilter.splice(groupsFilter.indexOf('Europe'), 1);
			d3.select(this).attr('fill-opacity', 0.25);
		} else {
			groupsFilter.push('Europe');
			d3.select(this).attr('fill-opacity', 1);
		}
	});

	mapLegend
	.append('path')
	.attr('class', 'legend americas')
	.datum(topojson.merge(world_simplified, world_simplified.objects.ne_10m_admin_0_countries.geometries.filter(d => d.properties.REGION_UN == 'Americas')))
	.attrs({
		'd': path,
		'fill': colourScale('Americas')
	})
	.on("click", function() {
		if (groupsFilter.includes('Americas')) {
			groupsFilter.splice(groupsFilter.indexOf('Americas'), 1);
			d3.select(this).attr('fill-opacity', 0.25);
		} else {
			groupsFilter.push('Americas');
			d3.select(this).attr('fill-opacity', 1);
		}
	});

	mapLegend
	.append('path')
	.attr('class', 'legend africa')
	.datum(topojson.merge(world_simplified, world_simplified.objects.ne_10m_admin_0_countries.geometries.filter(d => d.properties.REGION_UN == 'Africa')))
	.attrs({
		'd': path,
		'fill': colourScale('Africa')
	})
	.on("click", function() {
		if (groupsFilter.includes('Africa')) {
			groupsFilter.splice(groupsFilter.indexOf('Africa'), 1);
			d3.select(this).attr('fill-opacity', 0.25);
		} else {
			groupsFilter.push('Africa');
			d3.select(this).attr('fill-opacity', 1);
		}
	});

	mapLegend
	.append('path')
	.attr('class', 'legend oceania')
	.datum(topojson.merge(world_simplified, world_simplified.objects.ne_10m_admin_0_countries.geometries.filter(d => d.properties.REGION_UN == 'Oceania')))
	.attrs({
		'd': path,
		'fill': colourScale('Oceania')
	})
	.on("click", function() {
		if (groupsFilter.includes('Oceania')) {
			groupsFilter.splice(groupsFilter.indexOf('Oceania'), 1);
			d3.select(this).attr('fill-opacity', 0.25);
		} else {
			groupsFilter.push('Oceania');
			d3.select(this).attr('fill-opacity', 1);
		}
	});

	mapLegend
	.append('path')
	.attr('class', 'legend china')
	.datum(topojson.merge(world_simplified, world_simplified.objects.ne_10m_admin_0_countries.geometries.filter(d => d.properties.ADMIN == 'China')))
	.attrs({
		'd': path,
		'fill': colourScale('China'),
		'fill-opacity': 0.25
	})
	.on("click", function() {
		if (groupsFilter.includes('China')) {
			groupsFilter.splice(groupsFilter.indexOf('China'), 1);
			d3.select(this).attr('fill-opacity', 0.25);
		} else {
			groupsFilter.push('China');
			d3.select(this).attr('fill-opacity', 1);
			mapSubtitle.html('Click region to toggle.');
		}
	});

	mapLegend
	.selectAll('circle')
	.data(daySlice, d => d.Country)
	.enter()
	.append('circle')
	.attrs({
		class: 'countryMarker',
		cx: d => projection([d.Lon, d.Lat])[0],
		cy: d => projection([d.Lon, d.Lat])[1],
		r: d => d.cases / x.domain()[1] * (map.circlemax - map.circlemin) + map.circlemin
	})
	.styles({
		stroke: '#666666',
		fill: '#000000',
		'fill-opacity': 0.3
	});
}

function createSlider () {
	let dataTime = d3.range(0, endDay + 1, parseInt(endDay / 8)).map(function(d) {
		return d;
	});

	sliderDay = d3
	.sliderBottom()
	.min(0)
	.max(endDay)
	.step(1)
	.width(900)
	.tickValues(dataTime)
	.displayFormat(d => startDate.clone().add(d, 'day').format('D MMM'))
	.tickFormat(d => startDate.clone().add(d, 'day').format('D MMM'))
	.default(startDay)
	.on('onchange', val => {
		day = val;
	})
	.on('start', val => {
		if (playButton.text() == "Pause") {
			revert = true;
		}
		animating = false;
	})
	.on('end', val => {
		if (revert) {
			animating = true;
			revert = false;
		}
	});

	var gTime = d3
	.select('div#slider-time')
	.append('svg')
	.attrs({
		viewBox: '0 0 960 60',
		width: '100%',
		preserveAspectRatio: 'xMidYMin meet'
	})
	.append('g')
	.attr('transform', 'translate(30,10)');

	gTime.call(sliderDay);
}

function setEvents() {
	playButton
	.on("click", function() {
		var button = d3.select(this);
		if (button.text() == "Pause") {
			animating = false;
		} else {
			animating = true;
			if (day == endDay) {
				startDayFilter = data.filter(d => d.cases > 0 && groupsFilter.includes(d.Group));
				startDay = d3.min(startDayFilter, function(d) {
					return +d.Day;
				});

				day = startDay;
				svg.selectAll('.bar,.flag,.valueLabel,.label,.background')
				.remove();
			}
		}
	});

	svg.selectAll('.bar,.label,.flag')
	.on("mouseover", function(d) {
		tooltipVar.country = d.Country;
		tooltipVar.left = (d3.event.pageX + (d3.event.pageX < window.innerWidth / 2 ? 0 : -125)) + "px";
		tooltipVar.top = (d3.event.pageY - 28) + "px";
	})
	.on("mouseout", function(d) {
		tooltipVar.country = undefined;
	});

	svg2.selectAll('.countryMarker')
	.on("mouseover", function(d) {
		tooltipVar.country = d.Country;
		tooltipVar.left = (d3.event.pageX + (d3.event.pageX < window.innerWidth / 2 ? 0 : -125)) + "px";
		tooltipVar.top = (d3.event.pageY - 28) + "px";
		drawTooltip();
	})
	.on("mouseout", function(d) {
		tooltipVar.country = undefined;
		drawTooltip();
	});
}