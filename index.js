/** @format */

const fs = require('fs');
const path = require('path');
const less = require('less');
const hash = require('hash.js');
const rimraf = require('rimraf');
const uglifycss = require('uglifycss');

const withPath = require('./withPath');
const genModuleLess = require('./genModuleLess');
const getVariable = require('./getVariable');
const loopAllLess = require('./loopAllLess');

const darkTheme = {
  dark: true,
};

const genHashCode = (content) => hash.sha256().update(content).digest('hex');

const tempPath = withPath(path.join(__dirname, './.temp/'));

const loadAntd = async (ignoreAntd, { dark = false, compact = false }) => {
  try {
    if (ignoreAntd) {
      fs.writeFileSync(
        path.join(tempPath, './antd.less'),
        `@import '../color/bezierEasing';
      @import '../color/colorPalette';
      @import "../color/tinyColor";
          `,
      );
      return false;
    }

    const ignoreFiles = [];
    if (!dark) {
      ignoreFiles.push('themes/dark.less');
    }
    if (!compact) {
      ignoreFiles.push('themes/compact.less');
    }
    const antdPath = require.resolve('antd');
    if (fs.existsSync(antdPath)) {
      await loopAllLess(path.resolve(path.join(antdPath, '../../es/')), ignoreFiles).then(
        (content) => {
          fs.writeFileSync(
            path.join(tempPath, './antd.less'),
            `@import '../color/bezierEasing';
@import '../color/colorPalette';
@import "../color/tinyColor";
      ${content}
            `,
          );
        },
      );
      return true;
    }
  } catch (error) {
    console.log(error);
  }

  fs.writeFileSync(
    path.join(tempPath, './antd.less'),
    `@import '../color/bezierEasing';
@import '../color/colorPalette';
@import "../color/tinyColor";
    `,
  );
  return false;
};

const loadLibraryComponents = async ({ filterFileLess, extraLibraries = [] }) => {
  const components = ['@ant-design/pro-layout', '@ant-design/pro-table', ...extraLibraries];
  try {
    if (components) {
      const jobs = [];
      components.forEach((item) => {
        if (filterFileLess && !filterFileLess(item)) {
          return;
        }
        const componentPath = require.resolve(item);
        if (fs.existsSync(componentPath)) {
          jobs.push(loopAllLess(path.resolve(path.join(componentPath, '../../es/')), []));
        }
      });
      const contentList = await Promise.all(jobs);
      fs.writeFileSync(
        path.join(tempPath, '/components.less'),
        `@import './antd';
${contentList.join('\n')}
    `,
      );
    }
  } catch (error) {
    fs.writeFileSync(path.join(tempPath, '/components.less'), "@import './antd';");
  }

  fs.writeFileSync(path.join(tempPath, '/layout.less'), "@import './antd';");
  return false;
};

const getModifyVars = (theme = 'light', modifyVars, disableExtendsDark) => {
  try {
    if (theme === 'dark') {
      return {
        ...(disableExtendsDark ? {} : darkTheme),
        ...modifyVars,
      };
    }
    return { dark: false, ...modifyVars };
  } catch (error) {
    throw error;
  }
};

const getOldFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return false;
};

let isEqual = false;

const genProjectLess = (
  filePath,
  { isModule, loadAny, cache, ignoreAntd, ignoreProLayout, ...rest },
) =>
  genModuleLess(filePath, { isModule, ...rest }).then(async (content) => {
    if (cache === false) {
      rimraf.sync(tempPath);
    }
    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath);
    }

    const tempFilePath = withPath(path.join(tempPath, 'temp.less'));

    // 获取新旧文件的 hash
    const newFileHash = genHashCode(content);

    const oldFileHash = genHashCode(getOldFile(tempFilePath));
    if (newFileHash === oldFileHash) {
      isEqual = true;
      // 无需重复生成
      return false;
    }

    fs.writeFileSync(tempFilePath, content);

    try {
      if (loadAny) {
        fs.writeFileSync(
          withPath(path.join(tempPath, 'pro.less')),
          `@import './components';
           ${content}`,
        );
      } else {
        const lessContent = await getVariable(
          tempFilePath,
          fs.readFileSync(tempFilePath),
          loadAny,
        ).then((result) => result.content.toString());

        fs.writeFileSync(
          withPath(path.join(tempPath, 'pro.less')),
          `@import './components';
           ${lessContent}`,
        );
      }
    } catch (error) {
      console.log(error.name, error.file, `line: ${error.line}`);
    }
    await loadLibraryComponents(rest);

    return true;
  });

const modifyVarsArrayPath = path.join(tempPath, 'modifyVarsArray.json');

const modifyVarsIsEqual = (modifyVarsArray = '') => {
  const modifyVarsArrayString = JSON.stringify(modifyVarsArray);

  const old = getOldFile(modifyVarsArrayPath);
  if (old && genHashCode(old) === genHashCode(modifyVarsArrayString) && isEqual) {
    console.log('📸  less and modifyVarsArray is equal!');
    return true;
  }

  return false;
};

const renderLess = async (
  theme = 'light',
  modifyVars,
  { min = true, ignoreAntd = false, disableExtendsDark = false },
) => {
  const proLess = withPath(path.join(tempPath, './pro.less'));
  if (!fs.existsSync(proLess)) {
    return '';
  }
  const myModifyVars = getModifyVars(theme || 'light', modifyVars, disableExtendsDark);

  await loadAntd(ignoreAntd, {
    dark: myModifyVars.dark,
    compact: myModifyVars.compact,
  });

  return (
    less
      .render(fs.readFileSync(proLess, 'utf-8'), {
        modifyVars: myModifyVars,
        javascriptEnabled: true,
        filename: path.resolve(proLess),
      })
      // 如果需要压缩，再打开压缩功能默认打开
      .then((out) => (min ? uglifycss.processString(out.css) : out.css))
      .catch((e) => {
        console.log(e);
      })
  );
};

const build = async (
  cwd,
  modifyVarsArray,
  propsOption = { isModule: true, loadAny: false, cache: true },
) => {
  console.log('🔩 less render start!');
  isEqual = false;
  const defaultOption = { isModule: true, cache: true };
  const option = {
    ...defaultOption,
    ...propsOption,
  };
  try {
    const needBuild = await genProjectLess(cwd, option);
    if (!needBuild && modifyVarsIsEqual(modifyVarsArray)) {
      console.log('🎩 less render end!');
      return;
    }

    const loop = async (index) => {
      if (!modifyVarsArray[index]) {
        return false;
      }
      const { theme, modifyVars, fileName, disableExtendsDark } = modifyVarsArray[index];

      try {
        const css = await renderLess(theme, modifyVars, {
          ...option,
          disableExtendsDark,
        });
        fs.writeFileSync(fileName, css);
        // 写入缓存的变量值设置
        fs.writeFileSync(modifyVarsArrayPath, JSON.stringify(modifyVars));
      } catch (error) {
        console.log(error);
      }
      if (index < modifyVarsArray.length) {
        await loop(index + 1);
        return true;
      }
      return true;
    };
    // 写入缓存的变量值设置
    fs.writeFileSync(modifyVarsArrayPath, JSON.stringify(modifyVarsArray));
    await loop(0);
    console.log('🎩 less render end!');
  } catch (error) {
    console.log(error);
  }
};

module.exports = { build, withPath };
