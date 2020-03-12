var rdf = require('rdf-ext')
var SparqlClient = require('sparql-http-client')
var ClusterizePaging = require('clusterize.js-paging')

var terms = {
  numberOfResults: rdf.namedNode('http://voc.zazuko.com/zack#numberOfResults'),
  queryStart: rdf.namedNode('http://voc.zazuko.com/zack#queryStart'),
  queryEnd: rdf.namedNode('http://voc.zazuko.com/zack#queryEnd'),
  type: rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  score: rdf.namedNode('http://voc.zazuko.com/zack#score')
}

function SparqlSearchResultList (options) {
  this.options = options || {}

  this.client = new SparqlClient({
    endpointUrl: options.endpointUrl
  })

  this.resultTypes = options.resultTypes.map(function (resultType) {
    if (typeof resultType === 'string') {
      return rdf.namedNode(resultType)
    } else {
      return resultType
    }
  })

  this.rows = []

  this.start = ''
  this.end = ''

  this.clusterize = new ClusterizePaging({
    rows: this.rows,
    scrollId: options.scrollArea || 'scrollArea',
    contentId: options.contentArea || 'contentArea',
    dummyRow: options.dummyResult,
    no_data_text: 'No results found matching the filters.',
    pageSize: options.pageSize,
    preload: options.preload || 50,
    callbacks: {
      loadRows: this.loadRows.bind(this),
      rowsLoaded: options.onResultRendered
    }
  })
}

SparqlSearchResultList.prototype.search = function (query) {
  var self = this

  this.query = query

  if (this.options.onFetching) {
    this.options.onFetching()
  }

  return this.fetchResultLength().then(function (length) {
    var metadata = {
      length: length,
      start: self.start,
      end: self.end
    }

    if (self.options.onResultMetadata) {
      self.options.onResultMetadata(metadata)
    }

    if (self.options.onFetched) {
      self.options.onFetched()
    }

    return self.clusterize.init(length)
  })
}

SparqlSearchResultList.prototype.buildMetadataFilterQuery = function () {
  return this.options.metadataQueryTemplate
}

SparqlSearchResultList.prototype.buildMetadataQuery = function () {
  return this.buildMetadataFilterQuery().replace(/\${searchString}/g, this.query)
}

SparqlSearchResultList.prototype.fetchResultLength = function () {
  var self = this
  var query = this.buildMetadataQuery()

  return this.client.query.construct(query, { operation: 'postUrlencoded' }).then(function (stream) {
    return rdf.dataset().import(stream)
  }).then(function (graph) {
    var count = graph.match(null, terms.numberOfResults).toArray().shift()

    var querystart = graph.match(null, terms.queryStart).toArray().shift()
    var queryend = graph.match(null, terms.queryEnd).toArray().shift()

    if (!querystart && !queryend) {
      self.start = ''
      self.end = ''
    } else {
      self.start = new Date(querystart.object.value)
      self.end = new Date(queryend.object.value)
    }

    if (!count) {
      return 0
    }

    return parseInt(count.object.value)
  })
}

SparqlSearchResultList.prototype.buildResultFilterQuery = function () {
  return this.options.resultQueryTemplate
}

SparqlSearchResultList.prototype.buildResultQuery = function (offset) {
  return this.buildResultFilterQuery()
    .replace('${searchString}', this.query) // eslint-disable-line no-template-curly-in-string
    .replace('${offset}', offset) // eslint-disable-line no-template-curly-in-string
    .replace('${limit}', this.options.pageSize) // eslint-disable-line no-template-curly-in-string
}

SparqlSearchResultList.prototype.fetchPage = function (offset) {
  var query = this.buildResultQuery(offset)

  return this.client.query.construct(query, { operation: 'postUrlencoded' }).then(function (stream) {
    return rdf.dataset().import(stream)
  })
}

SparqlSearchResultList.prototype.resultSubjects = function (page) {
  var subjects = this.resultTypes.map(function (resultType) {
    return page.match(null, terms.type, resultType).toArray().map(function (triple) {
      return triple.subject
    })
  }).reduce(function (pre, cur) {
    return pre.concat(cur)
  })

  // sort subjects if they have a score property
  if (page.match(null, terms.score).length > 0) {
    subjects = subjects.sort(function (a, b) {
      var scoreA = parseFloat(page.match(a, terms.score).toArray().shift().object.value)
      var scoreB = parseFloat(page.match(b, terms.score).toArray().shift().object.value)

      return scoreB - scoreA
    })
  }

  return subjects
}

SparqlSearchResultList.prototype.loadRows = function (offset) {
  var self = this

  if (this.options.onFetching) {
    this.options.onFetching()
  }

  return this.fetchPage(offset).then(function (page) {
    var subjects = self.resultSubjects(page)

    if (self.options.onFetched) {
      self.options.onFetched()
    }

    return subjects.map(function (subject, index) {
      return self.options.renderResult(page, subject)
    })
  })
}

module.exports = SparqlSearchResultList
