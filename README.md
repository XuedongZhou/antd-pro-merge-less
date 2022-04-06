## antd-pro-merge-less

使用方式：

```js
const { build } = require('antd-pro-merge-less');
const darkTheme = require('antd/dist/dark-theme');
const lightTheme = require('antd/dist/default-theme');

build(
  'C:/GitHub/ant-design',
  [
    {
      theme: 'dark',
      modifyVars: {
        ...darkTheme
      },
      fileName: './.temp/dark.css',
    },
    {
      fileName: './.temp/mingQing.css',
      modifyVars: {
        ...lightTheme,
        '@primary-color': '#13C2C2',
      },
    },
  ],
  {
    // 是否压缩css
    min: false,
    // css module
    isModule: false,
    // 忽略 antd 的依赖,用于打包 antd 自己的依赖
    ignoreAntd: true,
    // 忽略 pro-layout 的依赖
    ignoreProLayout: true,
    // 不使用缓存
    cache: false,
    filterFileLess: (filename) => boolean,
    extraLibraries: [],
  },
);
```
