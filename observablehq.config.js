// See https://observablehq.com/framework/config
export default {
  root: "src",
  output: "dist",
  title: "Darby's Widgets",
  pager: false,
  sidebar: false,
  footer: `© ${new Date().getFullYear()} Darby's Widgets · lee-river.com`,
  pages: [
    {name: "S&P 500 Regression Lines", path: "/sp500"},
    {name: "US Deficit Regression Lines", path: "/deficits"},
    {name: "TapIt — Reaction Game", path: "/tapit"}
  ]
};
