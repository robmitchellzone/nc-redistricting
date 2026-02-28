// @ts-check
import './main.css';
import {select} from 'd3-selection';
import {geoMercator, geoPath} from 'd3-geo';
import {json, csv} from 'd3-fetch';
import {scaleQuantize} from 'd3-scale';
import {schemeRdBu} from 'd3-scale-chromatic';

/**
 * @typedef {Object} ElectionViewSpec
 * @property {string} key
 * @property {string} year
 * @property {string} chamber
 * @property {string} mapSourceKey
 */

/**
 * @typedef {Object} ResultRow
 * @property {string} year
 * @property {string} chamber
 * @property {string} district_number
 * @property {string} dem_percent
 */

/**
 * @typedef {Object} DistrictFeature
 * @property {{District: number|string}} properties
 */

/**
 * @typedef {Object} MapGeoJson
 * @property {Array<DistrictFeature>} features
 */

/**
 * @typedef {Object} ElectionView
 * @property {string} key
 * @property {string} year
 * @property {string} chamber
 * @property {MapGeoJson} mapGeoJson
 * @property {Array<ResultRow>} results
 */

const MAP_WIDTH = 700;
const MAP_HEIGHT = 300;
const MAP_SOURCE_KEYS = [
  'h02',
  'h04-08',
  'h10',
  'h12-16',
  'h18',
  'h20',
  's02',
  's04-10',
  's12-16',
  's18',
  's20',
];
const MAP_SOURCE_FILES = {
  'h02': './data/final/h02.json',
  'h04-08': './data/final/h04-08.json',
  'h10': './data/final/h10.json',
  'h12-16': './data/final/h12-16.json',
  'h18': './data/final/h18.json',
  'h20': './data/final/h20.json',
  's02': './data/final/s02.json',
  's04-10': './data/final/s04-10.json',
  's12-16': './data/final/s12-16.json',
  's18': './data/final/s18.json',
  's20': './data/final/s20.json',
};
/** @type {Array<ElectionViewSpec>} */
const ELECTION_VIEW_SPECS = [
  {key: '02H', year: '2002-01-01', chamber: 'house', mapSourceKey: 'h02'},
  {key: '02S', year: '2002-01-01', chamber: 'senate', mapSourceKey: 's02'},
  {key: '04H', year: '2004-01-01', chamber: 'house', mapSourceKey: 'h04-08'},
  {key: '04S', year: '2004-01-01', chamber: 'senate', mapSourceKey: 's04-10'},
  {key: '06H', year: '2006-01-01', chamber: 'house', mapSourceKey: 'h04-08'},
  {key: '06S', year: '2006-01-01', chamber: 'senate', mapSourceKey: 's04-10'},
  {key: '08H', year: '2008-01-01', chamber: 'house', mapSourceKey: 'h04-08'},
  {key: '08S', year: '2008-01-01', chamber: 'senate', mapSourceKey: 's04-10'},
  {key: '10H', year: '2010-01-01', chamber: 'house', mapSourceKey: 'h10'},
  {key: '10S', year: '2010-01-01', chamber: 'senate', mapSourceKey: 's04-10'},
  {key: '12H', year: '2012-01-01', chamber: 'house', mapSourceKey: 'h12-16'},
  {key: '12S', year: '2012-01-01', chamber: 'senate', mapSourceKey: 's12-16'},
  {key: '14H', year: '2014-01-01', chamber: 'house', mapSourceKey: 'h12-16'},
  {key: '14S', year: '2014-01-01', chamber: 'senate', mapSourceKey: 's12-16'},
  {key: '16H', year: '2016-01-01', chamber: 'house', mapSourceKey: 'h12-16'},
  {key: '16S', year: '2016-01-01', chamber: 'senate', mapSourceKey: 's12-16'},
  {key: '18H', year: '2018-01-01', chamber: 'house', mapSourceKey: 'h18'},
  {key: '18S', year: '2018-01-01', chamber: 'senate', mapSourceKey: 's18'},
  {key: '20H', year: '2020-01-01', chamber: 'house', mapSourceKey: 'h20'},
  {key: '20S', year: '2020-01-01', chamber: 'senate', mapSourceKey: 's20'},
];
const DEFAULT_VIEW_KEY = ELECTION_VIEW_SPECS[0].key;
const LEGEND_KEYS = ['90%', '80%', '70%', '60%', '50%', '50%', '60%', '70%', '80%', '90%'];
const LEGEND_VALUES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const PARTY_LABELS = ['Republican vote', 'Democratic vote'];
/** @type {Array<string>} */
const DATA_FILES = MAP_SOURCE_KEYS.map(sourceKey => MAP_SOURCE_FILES[sourceKey]);

/**
 * Build a dictionary of election views keyed by chamber-year code (for example,
 * 02H or 18S). Each view keeps the same raw result-row ordering used by the
 * original app so district colors render exactly as before.
 *
 * @param {Array<MapGeoJson|Array<ResultRow>>} loadedData
 * @returns {Record<string, ElectionView>}
 */
function createViewsByKey(loadedData) {
  const loadedMaps = loadedData.slice(0, MAP_SOURCE_KEYS.length);
  const results = loadedData[MAP_SOURCE_KEYS.length];
  /** @type {Record<string, MapGeoJson>} */
  const mapsBySourceKey = {};
  /** @type {Record<string, Array<ResultRow>>} */
  const resultsByViewKey = {};

  MAP_SOURCE_KEYS.forEach((sourceKey, index) => {
    mapsBySourceKey[sourceKey] = loadedMaps[index];
  });

  ELECTION_VIEW_SPECS.forEach(spec => {
    resultsByViewKey[spec.key] = [];
  });

  results.forEach(row => {
    const viewKey = `${row.year.slice(2, 4)}${row.chamber === 'house' ? 'H' : 'S'}`;
    if (resultsByViewKey[viewKey]) {
      resultsByViewKey[viewKey].push(row);
    }
  });

  /** @type {Record<string, ElectionView>} */
  const viewsByKey = {};

  ELECTION_VIEW_SPECS.forEach(spec => {
    viewsByKey[spec.key] = {
      key: spec.key,
      year: spec.year,
      chamber: spec.chamber,
      mapGeoJson: mapsBySourceKey[spec.mapSourceKey],
      results: resultsByViewKey[spec.key],
    };
  });

  return viewsByKey;
}

/**
 * @returns {import('d3-scale').ScaleQuantize<string>}
 */
function createColorScale() {
  return scaleQuantize([0, 1], schemeRdBu[10]);
}

/**
 * @param {MapGeoJson} initialMapData
 * @returns {import('d3-geo').GeoPath<any, DistrictFeature>}
 */
function createGeoGenerator(initialMapData) {
  const projection = geoMercator();
  projection.fitSize([MAP_WIDTH, MAP_HEIGHT], initialMapData);
  return geoPath().projection(projection);
}

/**
 * @returns {import('d3-selection').Selection<SVGSVGElement, unknown, HTMLElement, any>}
 */
function createSvg() {
  return select('#app')
    .append('svg')
    .attr('class', 'map')
    .attr('width', MAP_WIDTH)
    .attr('height', MAP_HEIGHT);
}

/**
 * @param {import('d3-selection').Selection<SVGSVGElement, unknown, HTMLElement, any>} svg
 * @returns {import('d3-selection').Selection<SVGGElement, unknown, null, undefined>}
 */
function createStateLayer(svg) {
  // Reuse one layer so map redraws replace paths instead of stacking groups.
  return svg.append('g').attr('id', 'state');
}

/**
 * @param {import('d3-selection').Selection<SVGSVGElement, unknown, HTMLElement, any>} svg
 * @param {import('d3-scale').ScaleQuantize<string>} color
 * @returns {void}
 */
function renderLegend(svg, color) {
  const legendHeight = 20;
  const legendWidth = 40;

  // colorbar
  svg
    .append('g')
    .selectAll('legendBars')
    .data(LEGEND_VALUES)
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
    .data(LEGEND_KEYS)
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
    .data(PARTY_LABELS)
    .join('text')
    .attr('x', (_, i) => i * (legendWidth + 150) + 60)
    .attr('y', 220)
    .text(d => d)
    .attr('text-anchor', 'start')
    .attr('class', 'party-text');
}

/**
 * @param {import('d3-selection').Selection<SVGSVGElement, unknown, HTMLElement, any>} svg
 * @returns {import('d3-selection').Selection<SVGTextElement, unknown, null, undefined>}
 */
function createTooltip(svg) {
  return svg
    .append('text')
    .attr('class', 'tooltip')
    .attr('text-anchor', 'start')
    .style('opacity', 0)
    .attr('x', 160)
    .attr('y', 285);
}

/**
 * @param {import('d3-selection').Selection<SVGTextElement, unknown, null, undefined>} toolTip
 * @returns {{
 *   mouseover: () => void,
 *   mousemove: (event: unknown, d: DistrictFeature) => void,
 *   mouseleave: () => void
 * }}
 */
function createTooltipHandlers(toolTip) {
  return {
    mouseover() {
      toolTip.style('opacity', 1);
    },
    mousemove(event, d) {
      toolTip.text('District ' + d.properties.District);
    },
    mouseleave() {
      toolTip.style('opacity', 0);
    },
  };
}

/**
 * @param {{
 *   viewsByKey: Record<string, ElectionView>,
 *   state: import('d3-selection').Selection<SVGGElement, unknown, null, undefined>,
 *   geoGenerator: import('d3-geo').GeoPath<any, DistrictFeature>,
 *   color: import('d3-scale').ScaleQuantize<string>,
 *   tooltipHandlers: {
 *     mouseover: () => void,
 *     mousemove: (event: unknown, d: DistrictFeature) => void,
 *     mouseleave: () => void
 *   }
 * }} config
 * @returns {(viewKey: string) => void}
 */
function createMapRenderer(config) {
  const {viewsByKey, state, geoGenerator, color, tooltipHandlers} = config;

  /**
   * @param {string} viewKey
   * @returns {void}
   */
  return function renderMap(viewKey) {
    const electionView = viewsByKey[viewKey];
    if (!electionView) {
      console.error(`No election view found for key: ${viewKey}`);
      return;
    }

    const colorArray = electionView.results.map(row => color(Number(row.dem_percent)));

    state
      .selectAll('path')
      .data(electionView.mapGeoJson.features)
      .join('path')
      .attr('d', geoGenerator)
      .attr('class', 'district')
      .attr('fill', d => colorArray[d.properties.District - 1])
      .attr('stroke', '#000')
      .on('mouseover', tooltipHandlers.mouseover)
      .on('mousemove', tooltipHandlers.mousemove)
      .on('mouseleave', tooltipHandlers.mouseleave);
  };
}

/**
 * @param {(viewKey: string) => void} onSelectionChange
 * @returns {void}
 */
function bindSelectionControl(onSelectionChange) {
  // credit to stephenspann https://stackoverflow.com/a/24225000
  select('#year-chamber').on('change', function() {
    const viewKey = String(select(this).property('value'));
    onSelectionChange(viewKey);
  });
}

/**
 * @param {Array<MapGeoJson|Array<ResultRow>>} loadedData
 * @returns {void}
 */
function initializeApp(loadedData) {
  const viewsByKey = createViewsByKey(loadedData);
  const color = createColorScale();
  const svg = createSvg();
  const state = createStateLayer(svg);
  const geoGenerator = createGeoGenerator(viewsByKey[DEFAULT_VIEW_KEY].mapGeoJson);

  // legend is the same so no need to update
  renderLegend(svg, color);

  const toolTip = createTooltip(svg);
  const tooltipHandlers = createTooltipHandlers(toolTip);
  const renderMap = createMapRenderer({
    viewsByKey,
    state,
    geoGenerator,
    color,
    tooltipHandlers,
  });

  renderMap(DEFAULT_VIEW_KEY);
  bindSelectionControl(renderMap);
}

Promise.all([...DATA_FILES.map(path => json(path)), csv('./data/final/full_df.csv')])
  .then(loadedData => {
    initializeApp(loadedData);
  })
  .catch(error => {
    console.error('Failed to load visualization data:', error);
    select('#app')
      .append('p')
      .style('color', '#b00020')
      .text('Unable to load map data. Please refresh and try again.');
  });
