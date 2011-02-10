
window.dc = window.dc || {};
window.dc.embed = window.dc.embed || {};
  
dc.loadSearchEmbed = function(searchUrl, opts) {
  var query = Inflector.sluggify(opts['q']);
  
  dc.embed[query] = {};
  dc.embed[query].options = opts = _.extend({}, {
    searchUrl     : searchUrl,
    originalQuery : opts['q'],
    per_page      : 12,
    order         : 'score',
    search_bar    : true,
    page          : 1
  }, opts);
  
  var apiOptions = {
    q              : opts['q'],
    original_query : opts['originalQuery'],
    callback       : 'dc.loadSearchEmbedCallback',
    per_page       : opts['per_page'],
    order          : opts['order'],
    page           : opts['page']
  };
  $.getScript(searchUrl + '?' + $.param(apiOptions));
};

dc.loadSearchEmbedCallback = function(json) {
  var query = Inflector.sluggify(json.original_query);
  dc.embed[query].options['id'] = query;
  _.extend(dc.embed[query].options, {
    total    : json.total,
    per_page : json.per_page,
    page     : json.page
  });
  
  if (dc.embed[query].documents) {
    dc.embed[query].documents.refresh(json.documents);
  } else {
    dc.embed[query].documents = new dc.EmbedDocumentSet(json.documents, dc.embed[query].options);
  }
  
  if (!dc.embed[query].workspace) {
    dc.embed[query].workspace = new dc.EmbedWorkspaceView(dc.embed[query].options);
  }
};

dc.EmbedDocument = Backbone.Model.extend({

  url : function() {
    return this.get('resources')['published_url'] || this.get('canonical_url');
  },
  
  isPrivate : function() {
    return this.get('access') == 'organization' || this.get('access') == 'private';
  }
  
});

dc.EmbedDocumentSet = Backbone.Collection.extend({

  model : dc.EmbedDocument,
  
  initialize : function(models) {
    this.originalModels = models;
  }

});

dc.EmbedWorkspaceView = Backbone.View.extend({
  
  className : 'DC-search-embed',
  
  events : {
    'click    .DC-cancel-search' : 'cancelSearch',
    'click    .DC-arrow-right'   : 'nextPage',
    'click    .DC-arrow-left'    : 'previousPage',
    'click    .DC-page-current'  : 'editPage',
    'change   .DC-page-edit'     : 'changePage',
    'keypress .DC-search-box'    : 'maybePerformSearch'
  },
  
  initialize : function() {
    this.embed     = dc.embed[this.options.id];
    this.container = $('#' + this.options['container']);
    this.embed.documents.bind('refresh', _.bind(this.renderDocuments, this));
    this.render();
  },
  
  render : function() {
    $(this.el).html(JST['workspace']({
        options : this.embed.options
    }));
    this.container.html(this.el);
    
    this.search = this.$('.DC-search-box');
    
    this.search.placeholder({className: 'DC-placeholder DC-interface'});
    this.renderDocuments();
  },
  
  renderDocuments : function() {
    var options = this.embed.options;
    var $document_list = this.$('.DC-document-list');
    $document_list.empty();
    
    if (!this.embed.documents.length) {
      $document_list.append(JST['no_results']({}));
    } else {
      this.embed.documents.each(_.bind(function(doc) {
        var view = (new dc.EmbedDocumentView({model: doc})).render().el;
        $document_list.append(view);
      }, this));
    }
    console.log(['render', this]);
    this.$('.DC-paginator').removeClass('DC-is-editing').html(JST['paginator']({
      total      : options.total,
      per_page   : options.per_page,
      page       : options.page,
      page_count : Math.ceil(options.total / options.per_page),
      from       : (options.page-1) * options.per_page,
      to         : Math.min(options.page * options.per_page, options.total)
    }));
  },
  
  cancelSearch : function(e) {
    e.preventDefault();
    this.search.val('').blur();
    this.performSearch();
  },
  
  maybePerformSearch : function(e) {
    if (e.keyCode != 13) return; // Search on `enter` only
    var force = this.embed.options.page != 1;
    this.embed.options.page = 1;
    this.performSearch(force);
  },
  
  performSearch : function(force) {
    var query = this.$('.DC-search-box').val();
    
    if (query == '' && !force) {
      this.embed.options = this.embed.originalOptions;
      // Returning to original query, just use the original response.
      this.embed.documents.refresh(this.embed.documents.originalModels);
    } else {
      this.embed.originalOptions = _.extend({}, this.embed.options);
      this.embed.options['q'] = this.embed.options['originalQuery'] + ' ' + query;
      dc.loadSearchEmbed(this.embed.options['searchUrl'], this.embed.options);
    }
  },
  
  nextPage : function() {
    this.embed.options.page += 1;
    this.performSearch(true);
  },
  
  previousPage : function() {
    this.embed.options.page -= 1;
    this.performSearch(true);
  },

  editPage : function() {
    this.$('.DC-paginator').addClass('DC-is-editing');
    this.$('.DC-page-edit').focus().select();
  },
  
  changePage : function() {
    var page = Math.max(1, Math.min(
      parseInt(this.$('.DC-page-edit').val(), 10), 
      Math.ceil(this.embed.options.total / this.embed.options.per_page)
    ));
    this.embed.options.page = page;
    this.performSearch(true);
  }
  
});

dc.EmbedDocumentView = Backbone.View.extend({
  
  events : {
    'click' : 'open'
  },
  
  initialize : function() {
    this.render();
  },
  
  render : function() {
    $(this.el).html(JST['document']({doc: this.model}));
    return this;
  },
  
  open : function(e) {
    e.preventDefault();

    window.open(this.model.get('resources')['published_url'] || this.model.get('canonical_url'));

    return false;
  }
  
});