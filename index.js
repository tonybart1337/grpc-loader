const Promise = require('bluebird');
const os = require('os');
const fs = require('fs');
const path = require('path');
const rimraf = Promise.promisify(require('rimraf'));
const grpc = require('grpc');
const protobuf = require('protobufjs');
const loaderUtils = require('loader-utils');

const exe_ext = process.platform === 'win32' ? '.exe' : '';

const grpcToolsDir = path.join(path.dirname(require.resolve('grpc-tools')), 'bin');
const protoc = path.join(grpcToolsDir, 'protoc' + exe_ext);
const protocGrpcPlugin = path.join(grpcToolsDir, 'grpc_node_plugin' + exe_ext);

const tmpDir = path.join(os.tmpdir(), `grpc-loader-`);

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);
const mkdtemp = Promise.promisify(fs.mkdtemp);
const execFile = Promise.promisify(require('child_process').execFile, {
  multiArgs: true
});

function toUnixPath(str) {
  return str.replace(/\\/g, '\/');
}

async function getGeneratedFile(srcPath, dir) {
  const filePath = path.basename(srcPath).replace(/\.[^/.]+$/, '');
  const protocFilePath = path.join(dir, `${filePath}_pb.js`);
  const grpcFilePath = path.join(dir, `${filePath}_grpc_pb.js`);

  const grpcFileData = await readFile(grpcFilePath, 'utf8');

  return {
    protocFilePath,
    grpcFilePath,
    grpcFileData,
  };
}

function createTmpDir() {
  return mkdtemp(tmpDir);
}

function removeTmpDir(dir) {
  return rimraf(dir);
}

function generateOutput(protocFilePath, grpcFilePath) {
  return `
      exports.services = require('!!${grpcFilePath}');
      exports.messages = require('!!${protocFilePath}');
  `;
}

async function processStatic() {
  const dir = await createTmpDir();

  try {
    const [stdout, stderr] = await execFile(
      protoc, [
        `--proto_path=${path.dirname(this.resourcePath)}`,
        `--js_out=import_style=commonjs,binary:${dir}`,
        `--grpc_out=${dir}`,
        `--plugin=protoc-gen-grpc=${protocGrpcPlugin}`,
        this.resourcePath,
      ], {
        encoding: 'utf8'
      });

    if (stderr) this.emitError(stderr);

    const {
      protocFilePath,
      grpcFilePath,
      grpcFileData,
    } = await getGeneratedFile(this.resourcePath, dir);

    const protocFileName = path.basename(protocFilePath, '.js');
    const unixProtocFilePath = toUnixPath(protocFilePath);
    const unixGrpcFilePath = toUnixPath(grpcFilePath);

    // don't process the result
    const grpcFileContent = grpcFileData.replace(`require('./${protocFileName}.js');`, `require('!!${unixProtocFilePath}');`);

    await writeFile(grpcFilePath, grpcFileContent);

    return generateOutput(unixProtocFilePath, unixGrpcFilePath);
  } catch (err) {
    removeTmpDir(dir);
    throw err;
  }
}

function pickProps(o, props) {
  return props.reduce((m, k) => {
    m[k] = o[k];
    return m;
  }, {});
}

function pickGrpcProps(opts) {
  return pickProps(opts, [
    'convertFieldsToCamelCase',
    'binaryAsBase64',
    'longsAsStrings',
    'enumsAsStrings',
  ]);
}

async function processDynamic(grpcOpts) {
  const protoObj = await protobuf.load(this.resourcePath);
  const jsonDescriptor = JSON.stringify(protoObj.toJSON());

  return `
    const grpc = require('grpc');
    const protobuf = require('protobufjs');
    const opts = JSON.parse('${JSON.stringify(grpcOpts)}');

    module.exports = grpc.loadObject(protobuf.Root.fromJSON(JSON.parse('${jsonDescriptor}')), opts);
  `;
}

const defaultOptions = {
  static: true,
};

module.exports = async function(source) {
  if (this.cacheable) this.cacheable();

  const options = Object.assign({},
    defaultOptions,
    loaderUtils.getOptions(this),
  );

  const callback = this.async();
  let result = '';

  try {
    result = await (options.static ? processStatic : processDynamic).call(this, pickGrpcProps(options));
  } catch (err) {
    callback(err);
  }

  callback(null, result);
};
