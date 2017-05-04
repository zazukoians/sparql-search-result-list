var rdfFetch = require('rdf-fetch')
var SparqlClient = require('sparql-http-client')
var ClusterizePaging = require('clusterize.js-paging')

function SparqlSearchResultList (options) {
  this.options = options || {}

  this.client = new SparqlClient({
    fetch: rdfFetch,
    endpointUrl: options.endpointUrl,
    updateUrl: options.endpointUrl
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

  return this.client.postQuery(query).then(function (res) {
    var count = res.graph.match(null, 'http://voc.zazuko.com/zack#numberOfResults').toArray().shift()

    var querystart = res.graph.match(null, 'http://voc.zazuko.com/zack#queryStart').toArray().shift()
    var queryend = res.graph.match(null, 'http://voc.zazuko.com/zack#queryEnd').toArray().shift()

    if (!querystart && !queryend) {
      self.start = ''
      self.end = ''
    } else {
      self.start = new Date(querystart.object.nominalValue)
      self.end = new Date(queryend.object.nominalValue)
    }

    if (!count) {
      return 0
    }

    return parseInt(count.object.nominalValue)
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

  return this.client.postQuery(query).then(function (res) {
    return res.graph
  })
}

SparqlSearchResultList.prototype.resultSubjects = function (page) {
  var subjects = page.match(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', this.options.resultType).map(function (triple) {
    return triple.subject
  })

  // sort subjects if they have a score property
  if (page.match(null, 'http://voc.zazuko.com/zack#score').length > 0) {
    subjects = subjects.sort(function (a, b) {
      var scoreA = parseFloat(page.match(a, 'http://voc.zazuko.com/zack#score').toArray().shift().object.toString())
      var scoreB = parseFloat(page.match(b, 'http://voc.zazuko.com/zack#score').toArray().shift().object.toString())

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
