import './main.css';
import {select} from 'd3-selection';
import {geoMercator, geoPath} from 'd3-geo';
import {json, csv} from 'd3-fetch';
import {scaleQuantize} from 'd3-scale';
import {schemeRdBu} from 'd3-scale-chromatic';

function myViz(data) {
  const datasetMap = [
    {year: '2002-01-01', chamber: 'house', map: 0},
    {year: '2002-01-01', chamber: 'senate', map: 6},
    {year: '2004-01-01', chamber: 'house', map: 1},
    {year: '2004-01-01', chamber: 'senate', map: 7},
    {year: '2006-01-01', chamber: 'house', map: 1},
    {year: '2006-01-01', chamber: 'senate', map: 7},
    {year: '2008-01-01', chamber: 'house', map: 1},
    {year: '2008-01-01', chamber: 'senate', map: 7},
    {year: '2010-01-01', chamber: 'house', map: 2},
    {year: '2010-01-01', chamber: 'senate', map: 7},
    {year: '2012-01-01', chamber: 'house', map: 3},
    {year: '2012-01-01', chamber: 'senate', map: 8},
    {year: '2014-01-01', chamber: 'house', map: 3},
    {year: '2014-01-01', chamber: 'senate', map: 8},
    {year: '2016-01-01', chamber: 'house', map: 3},
    {year: '2016-01-01', chamber: 'senate', map: 8},
    {year: '2018-01-01', chamber: 'house', map: 4},
    {year: '2018-01-01', chamber: 'senate', map: 9},
    {year: '2020-01-01', chamber: 'house', map: 5},
    {year: '2020-01-01', chamber: 'senate', map: 10},
  ];
  const results = data[11];
  let width = 700;
  let height = 300;
  let projection = geoMercator();
  projection.fitSize([width, height], data[0]);
  let geoGenerator = geoPath().projection(projection);
  const color = scaleQuantize([0, 1], schemeRdBu[10]);
  const legendKeys = [
    '90%',
    '80%',
    '70%',
    '60%',
    '50%',
    '50%',
    '60%',
    '70%',
    '80%',
    '90%',
  ];
  const legendValues = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

  let svg = select('#app')
    .append('svg')
    .attr('class', 'map')
    .attr('width', width)
    .attr('height', height);
  // Reuse one layer so map redraws replace paths instead of stacking groups.
  const state = svg.append('g').attr('id', 'state');

  function myMap(values) {
    // draw the actual map
    const newData = data[values['map']];
    const thisYear = results.filter(
      row =>
        row['year'] === values['year'] && row['chamber'] === values['chamber'],
    );
    const colorArray = thisYear.map(row => color(row['dem_percent']));
    state
      .selectAll('path')
      .data(newData.features)
      .join('path')
      .attr('d', geoGenerator)
      .attr('class', 'district')
      .attr('fill', d => colorArray[d['properties']['District'] - 1])
      .attr('stroke', '#000')
      .on('mouseover', mouseover)
      .on('mousemove', mousemove)
      .on('mouseleave', mouseleave);
  }

  // legend is the same so no need to update
  const legendHeight = 20;
  const legendWidth = 40;
  // colorbar
  svg
    .append('g')
    .selectAll('legendBars')
    .data(legendValues)
    .join('rect')
    .attr('x', (_, i) => i * legendWidth)
    .attr('y', 250)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('fill', d => color(d));
  // numbers
  svg
    .append('g')
    .selectAll('legendLabels')
    .data(legendKeys)
    .join('text')
    .attr('x', (_, i) => i * legendWidth + 10)
    .attr('y', 240)
    .text(d => d)
    .attr('text-anchor', 'start')
    .attr('class', 'legend-text');
  // d and r
  svg
    .append('g')
    .selectAll('partyLabels')
    .data(['Republican vote', 'Democratic vote'])
    .join('text')
    .attr('x', (_, i) => i * (legendWidth + 150) + 60)
    .attr('y', 220)
    .text(d => d)
    .attr('text-anchor', 'start')
    .attr('class', 'party-text');
  // tooltip
  const toolTip = select('.map')
    .append('text')
    .attr('class', 'tooltip')
    .attr('text-anchor', 'start')
    .style('opacity', 0)
    .attr('x', 160)
    .attr('y', 285);
  // tooltip functions
  const mouseover = function() {
    toolTip.style('opacity', 1);
  };
  const mousemove = function(d) {
    toolTip.text('District ' + d.target.__data__.properties.District);
  };
  const mouseleave = function() {
    toolTip.style('opacity', 0);
  };

  myMap(datasetMap[0]);

  // credit to stephenspann https://stackoverflow.com/a/24225000
  select('#year-chamber').on('change', function() {
    const selectedIndex = Number(select(this).property('value'));
    const values = datasetMap[selectedIndex];
    myMap(values);
  });
}

Promise.all([
  json('./data/final/h02.json'),
  json('./data/final/h04-08.json'),
  json('./data/final/h10.json'),
  json('./data/final/h12-16.json'),
  json('./data/final/h18.json'),
  json('./data/final/h20.json'),
  json('./data/final/s02.json'),
  json('./data/final/s04-10.json'),
  json('./data/final/s12-16.json'),
  json('./data/final/s18.json'),
  json('./data/final/s20.json'),
  csv('./data/final/full_df.csv'),
]).then(maps => {
  myViz(maps);
}).catch(error => {
  console.error('Failed to load visualization data:', error);
  select('#app')
    .append('p')
    .style('color', '#b00020')
    .text('Unable to load map data. Please refresh and try again.');
});
