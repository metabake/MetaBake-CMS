"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Base_1 = require("mbake/lib/Base");
const FileOpsBase_1 = require("mbake/lib/FileOpsBase");
const FileOpsExtra_1 = require("mbake/lib/FileOpsExtra");
const Serv_1 = require("mbake/lib/Serv");
class EditorRoutes {
    routes(config) {
        const bodyParser = require("body-parser");
        const fs = require('fs');
        const path = require('path');
        const fileUpload = require('express-fileupload');
        const appE = Serv_1.ExpressRPC.makeInstance(config.corsUrlProd);
        appE.use(fileUpload());
        appE.use((request, response, next) => {
            const params = JSON.parse(request.fields.params);
            const resp = {};
            console.info('mbake version: ', Base_1.Ver.ver());
            let idToken = params['fb-auth-token'];
            if (typeof idToken === 'undefined') {
                return response.status(401).send();
            }
        });
        appE.use(bodyParser.json());
        appE.use(bodyParser.text());
        appE.use(bodyParser.urlencoded({ extended: true }));
        appE.post("/posts", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            if ('get' == method) {
                let dirs = new FileOpsBase_1.Dirs(config.appMount);
                let dirsToIgnore = ['', '.', '..'];
                resp.result = dirs.getShort()
                    .map(el => el.replace(/^\/+/g, ''))
                    .filter(el => !dirsToIgnore.includes(el));
                res.json(resp);
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/files", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            let params = JSON.parse(req.fields.params);
            if ('get' == method) {
                let post_id = '/' + params.post_id;
                if (typeof post_id !== 'undefined') {
                    let dirs = new FileOpsBase_1.Dirs(config.appMount);
                    resp.result = dirs.getInDir(post_id);
                    res.json(resp);
                }
                else {
                    res.status(400);
                    resp.result = { error: 'no post_id' };
                    res.json(resp);
                }
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/post-get", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            let params = JSON.parse(req.fields.params);
            if ('get' == method) {
                let post_id = params.post_id;
                let pathPrefix = params.pathPrefix;
                if (typeof post_id !== 'undefined') {
                    let md = config.appMount + '/' + pathPrefix + post_id;
                    let original_post_id = post_id.replace(/\.+\d+$/, "");
                    let fileExt = path.extname(original_post_id);
                    if (fs.existsSync(md) && (fileExt === '.md' || fileExt === '.yaml' || fileExt === '.csv' || fileExt === '.pug' || fileExt === '.css')) {
                        fs.readFile(md, 'utf8', function (err, data) {
                            if (err)
                                throw err;
                            resp.result = data;
                            res.json(resp);
                        });
                    }
                    else {
                        throw "Unknown file type!";
                    }
                }
                else {
                    res.status(400);
                    resp.result = { error: 'no post_id' };
                    res.json(resp);
                }
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/post-put", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            let params = JSON.parse(req.fields.params);
            if ('put' == method) {
                console.info("--res runnnning:");
                let post_id = params.post_id;
                let pathPrefix = params.pathPrefix;
                let content = params.content;
                content = Buffer.from(content, 'base64');
                if (typeof post_id !== 'undefined') {
                    let md = '/' + pathPrefix + post_id;
                    let fileOps = new FileOpsExtra_1.FileOps(config.appMount);
                    fileOps.write(md, content);
                    let dirCont = new FileOpsBase_1.Dirs(config.appMount);
                    let substring = '/';
                    let checkDat = dirCont.getInDir('/' + pathPrefix).filter(file => file.endsWith('dat.yaml'));
                    if (checkDat.length > 0) {
                        const archivePath = '/' + pathPrefix + '/archive';
                        if (!fs.existsSync(config.appMount + archivePath)) {
                            fs.mkdirSync(config.appMount + archivePath);
                        }
                        let archiveFileOps = new FileOpsExtra_1.FileOps(config.appMount + archivePath);
                        let extension = path.extname(post_id);
                        let fileName = path.basename(post_id, extension);
                        let count = archiveFileOps.count(path.basename(post_id));
                        let archiveFileName = '/' + fileName + extension + '.' + count;
                        archiveFileOps.write(archiveFileName, content);
                    }
                    if (pathPrefix.includes(substring)) {
                        pathPrefix = pathPrefix.substr(0, pathPrefix.indexOf('/'));
                    }
                    resp.result = { data: 'OK' };
                    res.json(resp);
                }
                else {
                    res.status(400);
                    resp.result = { error: 'no post_id' };
                    res.json(resp);
                }
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/post-build", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            let params = JSON.parse(req.fields.params);
            if ('put' == method) {
                let post_id = params.post_id;
                let pathPrefix = params.pathPrefix;
                if (typeof post_id !== 'undefined') {
                    let runMbake = new Base_1.MBake();
                    let dirCont = new FileOpsBase_1.Dirs(config.appMount);
                    let checkCsv = dirCont.getInDir('/' + pathPrefix).filter(file => file.endsWith('.csv'));
                    if (checkCsv.length > 0) {
                        let compileCsv = new FileOpsExtra_1.CSV2Json(config.appMount + '/' + pathPrefix);
                        compileCsv.convert();
                    }
                    let checkDat_i = dirCont.getInDir('/' + pathPrefix).filter(file => file.endsWith('dat_i.yaml'));
                    if (checkDat_i.length > 0) {
                        runMbake.itemizeNBake(config.appMount + '/' + pathPrefix, 3)
                            .then(function (response) {
                            resp.result = { data: 'OK' };
                            res.json(resp);
                        }, function (error) {
                            resp.result = { data: error };
                            res.json(resp);
                        });
                    }
                    else {
                        runMbake.compsNBake(config.appMount, 3).then(function (response) {
                            resp.result = { data: 'OK' };
                            res.json(resp);
                        }, function (error) {
                            resp.result = { data: error };
                            res.json(resp);
                        });
                    }
                }
                else {
                    res.status(400);
                    resp.result = { error: 'no post_id' };
                    res.json(resp);
                }
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/new-post", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            let params = JSON.parse(req.fields.params);
            if ('post' == method) {
                let post_id = params.post_id;
                let pathPrefix = params.pathPrefix;
                if (typeof post_id !== 'undefined'
                    && typeof pathPrefix !== 'undefined') {
                    let postPath = config.appMount + '/' + pathPrefix;
                    let substring = '/';
                    let newPost = '';
                    if (pathPrefix.includes(substring)) {
                        pathPrefix = pathPrefix.substr(0, pathPrefix.indexOf('/'));
                        newPost = config.appMount + '/' + pathPrefix + '/' + post_id;
                    }
                    else {
                        newPost = config.appMount + '/' + post_id;
                    }
                    let fileOps = new FileOpsExtra_1.FileOps('/');
                    fileOps.clone(postPath, newPost);
                    resp.result = { data: 'OK' };
                    res.json(resp);
                }
                else {
                    res.status(400);
                    resp.result = { error: 'error creating a post' };
                    res.json(resp);
                }
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/upload", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            let params = JSON.parse(req.fields.params);
            if ('post' == method) {
                let uploadPath;
                let pathPrefix = params.pathPrefix;
                let fileupload = params.fileupload;
                console.log('fileupload ---=====>', fileupload);
                if (Object.keys(req.files).length == 0) {
                    return res.status(400).send('No files were uploaded.');
                }
                let sampleFile = req.files.sampleFile;
                uploadPath = config.appMount + '/' + pathPrefix + '/' + sampleFile.name;
                sampleFile.mv(uploadPath, function (err) {
                    if (err) {
                        return res.status(500).send(err);
                    }
                    resp.result = { data: 'File uploaded!' };
                    res.json(resp);
                });
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/set-publish-date", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            let params = JSON.parse(req.fields.params);
            if ('put' == method) {
                let post_id = params.post_id;
                let publish_date = params.publish_date;
                if (typeof post_id !== 'undefined') {
                    let datYaml = new FileOpsBase_1.Dat(config.appMount + '/' + post_id);
                    datYaml.set('publishDate', publish_date);
                    datYaml.write();
                    let runMbake = new Base_1.MBake();
                    let postsFolder = post_id.substr(0, post_id.indexOf('/'));
                    let pro = runMbake.itemizeNBake(config.appMount + '/' + postsFolder, 3);
                    resp.result = { data: 'OK' };
                    res.json(resp);
                }
                else {
                    res.status(400);
                    resp.result = { error: 'no post_id' };
                    res.json(resp);
                }
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        appE.post("/mbake-version", (req, res) => {
            const method = req.fields.method;
            let resp = {};
            if ('get' == method) {
                console.info('endpoint mbake version --------------> ', Base_1.Ver.ver());
                resp.result = Base_1.Ver.ver();
                res.json(resp);
            }
            else {
                console.log('error', resp);
                return res.json(resp);
            }
        });
        return appE;
    }
    ;
}
exports.EditorRoutes = EditorRoutes;
module.exports = {
    EditorRoutes
};