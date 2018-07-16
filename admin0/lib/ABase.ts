
declare var module: any
declare var require: any
declare var process: any
declare var __dirname: any

const express = require('express')
const formidable = require('formidable')
const os = require('os')
const logger = require('tracer').console()
const fse = require('fs-extra')
const fs = require('fs')
const bodyParser = require('body-parser')
const httpreq = require('httpreq')
const AdmZip = require('adm-zip')





export class FileOps {
	root
	constructor(root_) {
		this.root = root_
	}

	downloadZip(folder, url, cb) {
		let pos = url.lastIndexOf('/')
		let fn = url.substring(pos)
		const full = this.root+folder
		logger.trace(full)
		logger.trace(url)

		var options = {
			timeout: 40*1000,
			binary: true
		}
		httpreq.get(url, options, function (errf, res){
			if (errf) throw errf

			logger.trace(res.statusCode)
			fs.writeFile(full +'/'+ fn, res.body, function (errw) {
				if (errw) throw errw

				logger.trace('downloaded')
				FileOps._unzip(full , fn)

				cb()

			 })//writeFile
		})//get
	}//()

	static _unzip(full, fn) {
		logger.trace(full+fn)

		let zip = new AdmZip(full+fn)
		zip.extractAllTo(full, /*overwrite*/true)
		//delete
		fs.unlinkSync(full+fn)
	}



	static hasWhiteSpace(s) {
		return s.indexOf(' ') >= 0;
	 }

	static READ_VALID = ['pug','yaml','md', 'css', 'txt', 'json', 'html','js','ts']

	read(folder, file):string {
		const ext = file.split('.').pop()
		if(!FileOps.READ_VALID.includes(ext))
			return 'other media'
		const full = this.root+folder +'/'+ file
		logger.trace(full)
		if (!fs.existsSync(full))
			return file + ' does not exists'

		const str:string = fs.readFileSync(full, 'utf8')
		return str
	}

	write(folder, file, txt:string):boolean {
		const ext = file.split('.').pop()
		if(!FileOps.READ_VALID.includes(ext))
			return false
		if(FileOps.hasWhiteSpace(file))
			return false
		const full = this.root+folder +'/'+ file
		logger.trace(full)

		fs.writeFileSync(full, txt, 'utf8')
		return true
	}

	listFiles(folder):string {
		logger.trace(this.root+folder)
		try {
			const files = fs.readdirSync(this.root+folder)
			let rows = []
			for (let i in files) {
				let f:string = files[i]
				if(FileOps.hasWhiteSpace(f))
					continue
				let row = []
				row.push( f ) //name
				const full = this.root+folder +'/'+ f
				const stats = fs.statSync(full)
				row.push ( f.split('.').pop() )// ext
				row.push(  stats.isDirectory() )

				rows.push(row)
			}// outer

			return JSON.stringify(rows)
		} catch (err) {
			logger.warn(err)
			return JSON.stringify({'error':'bad folder'})
		}
	}//()

}//FileOps

class SrvUtil {
	static itemize// ()
	static tags// ()

	static prop //ROOT folder, yaml, etc.
	static mount
	static app //express

	static secretProp = 'secret'
	static folderProp = 'folder'

	static srcProp = 'src'
	static destProp = 'dest'

	static WWW

	static ret(res, msg) {
		//logger.trace(msg)
		res.send(msg)
	}

	static removeFile(f) {
		logger.trace('remove')
		try {
			fse.removeSync(f.path)
		} catch(e) {
			logger.trace(e)
		}
	}//()


}

export class Srv {

	constructor( itemize_, tags_, prop_) {// functions to call
		SrvUtil.tags = tags_

		SrvUtil.itemize = itemize_
		SrvUtil.prop = prop_
		SrvUtil.mount = prop_.mount

		SrvUtil.app = express()
		SrvUtil.WWW = prop_.srv_www
		logger.trace(SrvUtil.WWW)
		SrvUtil.app.set('views', SrvUtil.WWW)

		//upload
		SrvUtil.app.get('/upload', function (req, res) {
			res.render('upload')
		})
	}

	uploadSetup() {//upload
		const secretProp = 'secret'
		const folderProp = 'folder'
		const SECRET = SrvUtil.prop.secret

		//form
		SrvUtil.app.post('/upload', function (req, res) {
			logger.trace('upload')
			const form = new formidable.IncomingForm()
			form.keepExtensions = true
			form.multiples = false
			form.parse(req, function(err, fields_, file__) {
				let file = file__.file

				if(err) {
					logger.trace(err)
					res.send( err )
					SrvUtil.removeFile(file)
					return
				}

				let sec =fields_[secretProp]
				if(sec!=SECRET) {
					logger.trace('wrong secret')
					res.status(422).send('wrong secret')
					SrvUtil.removeFile(file)
					return
				}

				let fn = file.name
				logger.trace(fn)
				let folder = fields_[folderProp]
				if(!folder || folder.length<2) {
					logger.trace('no folder')
					res.status(422).send('no folder')
					SrvUtil.removeFile(file)
					return
				}
				folder = SrvUtil.mount + folder +'/'
				logger.trace(folder)

				try {
					fn = folder + fn
					logger.trace(fn)
					fse.moveSync(file.path, fn, { overwrite: true })
				} catch(e) {
					logger.trace(e)
					res.status( 422 ).send( e )
					return
				}

				logger.trace('done')
				//done
				res.status(200)
				res.send( file.name)

			})
		})//post route

	}//()

	apiSetup() {//api
		this.uploadSetup()

		SrvUtil.app.use(bodyParser.text())// before

		SrvUtil.app.post('/api/write', function (req, res) {
			let qs = req.query
			if(!SrvUtil.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )
			if(!keys.includes(SrvUtil.folderProp)) {
				SrvUtil.ret(res,'no folder')
				return
			}

			try {
				let folder = qs[SrvUtil.folderProp]
				const fn = qs['fn']
				const fo = new FileOps(SrvUtil.mount)

				let txt = req.body
				let msg = fo.write(folder, fn, txt)

				fo.autoBake(folder, fn)

			} catch(err) {
				SrvUtil.ret(res, err)
			}
		})//

		SrvUtil.app.get('/api/downloadZip', function (req, res) {
			let qs = req.query
			if(!SrvUtil.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )
			if(!keys.includes(SrvUtil.folderProp)) {
				SrvUtil.ret(res,'no folder')
				return
			}

			try {
				let url = qs['url']
				logger.trace(url)
				const fo = new FileOps(SrvUtil.mount)
				fo.downloadZip(qs[SrvUtil.folderProp], url, function() {
					SrvUtil.ret(res,'done')
				})
			} catch(err) {
				SrvUtil.ret(res, err)
			}
		})//

		SrvUtil.app.get('/api/read', function (req, res) {
			let qs = req.query
			if(!SrvUtil.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )
			if(!keys.includes(SrvUtil.folderProp)) {
				SrvUtil.ret(res,'no folder')
				return
			}

			try {
				let folder = qs[SrvUtil.folderProp]
				const fn = qs['fn']
				const fo = new FileOps(SrvUtil.mount)

				let msg = fo.read(folder, fn)
				SrvUtil.ret(res, msg)
			} catch(err) {
				SrvUtil.ret(res, err)
			}
		})//

		SrvUtil.app.get('/api/list', function (req, res) {
			let qs = req.query
			if(!SrvUtil.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )
			if(!keys.includes(SrvUtil.folderProp)) {
				SrvUtil.ret(res,'no folder')
				return
			}

			try {
				let folder = qs[SrvUtil.folderProp]
				const fo = new FileOps(SrvUtil.mount)

				let msg = fo.listFiles(folder)
				SrvUtil.ret(res, msg)
			} catch(err) {
				SrvUtil.ret(res, err)
			}
		})//



		SrvUtil.app.get('/api/clone', function (req, res) {
			let qs = req.query
			if(!SrvUtil.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )

			let src = qs[SrvUtil.srcProp]
			let dest = qs[SrvUtil.destProp]
			let f = new FileOps(SrvUtil.prop.mount)
			let ret = f.clone(src,dest)
			SrvUtil.ret(res, ret)
		})//


		return this
	}//()

	start() {
		SrvUtil.app.use(express.static(SrvUtil.WWW))

		SrvUtil.app.listen(SrvUtil.prop.port, function () {
			logger.trace('port '+SrvUtil.prop.port)
		})

	}//()
}//class