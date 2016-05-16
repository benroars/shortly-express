Shortly.Router = Backbone.Router.extend({
  initialize: function(options) {
    this.$el = options.el;
  },

  routes: {
    '': 'index',
    'create': 'create',
    'login': 'login',
    'signup': 'signup'
  },

  swapView: function(view) {
    this.$el.html(view.render().el);
  },

  index: function() {
    var links = new Shortly.Links();
    var linksView = new Shortly.LinksView({ collection: links });
    this.swapView(linksView);
  },

  create: function() {
    this.swapView(new Shortly.createLinkView());
  },

  login: function() { //gets triggered in app js when you click the login button
    this.swapView(new Shortly.createLoginView());
  },

  signup: function() { //gets triggered in app js when you click the login button
    this.swapView(new Shortly.createSignupView());
  }
});