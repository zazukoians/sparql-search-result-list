# sparql-search-result-list

HTML search result list for SPARQL queries with paging support.

## Usage

The constructor has only an options argument with the  

    var SparqlSearchResultList = require('sparql-search-result-list')

    var resultList = new SparqlSearchResultList({...})

### SPARQL & dataset options 

- `endpointUrl`: URL of the SPARQL endpoint (required)
- `pageSize`: Number of rows a page contains (required)
- `preload`: Number of rows which will be loaded ahead before and after the current view (default: 50)
- `resultTypes`: An Array containing the rdf:type of the results (required)
- `metadataQueryTemplate`: SPARQL template for search metadata  (required)
- `resultQueryTemplate`: SPARQL template for search results (required)

#### SPARQL query templates

The templates must be given as a string.
`${searchString}` will be replaced by the search string.
`${offset}` and `${limit}` will be replaced in the result query with the offset and limit of the current page.

Dynamic templates can be implemented by replacing the `buildMetadataFilterQuery` and `buildResultFilterQuery` methods.

### Render options

- `scrollArea`: ID of the div block for the scroll area (default: `scrollArea`)
- `contentArea`: ID of the div block for the content area (default: `contentArea`)
- `dummyResult`: HTML as string that will be used until the row is loaded.
  This will be also used to calculate the row height! (required)
- `renderResult(Graph graph, NamedNode result)`: The function which renders the result row.
  The graph contains all results of the page.
  result is the subject of the current result row. (required)

#### HTML

[clusterize.js-paging](https://github.com/zazukoians/clusterize.js-paging) is used to render the result list.
The following HTML structure is required to render the list:

    <div id="scrollArea" class="clusterize-scroll">
      <div id="contentArea" class="clusterize-content">
        <div class="clusterize-no-data">Loading data…</div>
      </div>
    </div>

### Events

- `onResultRendered()`: Will be called after the current pages have been rendered
- `onFetched()`: Will be called after each result SPARQL query
- `onFetching()`: Will be called before each result SPARQL query
- `onResultMetadata(metadata)`: Will be called after the metadata has been fetched.
 It contains the `length`, `start` and `end`.

### Methods

- `search(searchString)`: Starts a new search with the given search string. 