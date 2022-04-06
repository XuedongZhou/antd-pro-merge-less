// order:
// 0. other/**/index.less
// 1. other/**.less
const lessOrder = filename => {
  let order = 0;
  if (!filename.includes('index.less')) {
    order += 1;
  }
  return order;
};

module.exports = lessOrder;
