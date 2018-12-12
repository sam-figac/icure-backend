/* global PDFJS, URL */

'use strict';

(function(window, undefined) {
  var Reader = function(el) {
    this.element = el;
    this.reader = Polymer.dom(el.root).querySelector('.pdf-viewer');
    this.viewportOut = this.reader.querySelector('.pdf-viewport-out');
    this.toolbar = this.reader.querySelector('.pdf-toolbar');
    this.toolbarHeight = this.toolbar.offsetHeight || 0;
    this.title = this.toolbar.querySelector('.title');
    this.enableTextSelection = el.enableTextSelection;
    this.fitWidth = el.fitWidth;
    this.fitHeight = el.fitHeight;
    this.HEIGHT = el.getAttribute('height');

    this.viewport = this.reader.querySelector('.pdf-viewport');

    if (this.enableTextSelection){
      this.textLayerDiv = this.reader.querySelector(".textLayer");
      this.textLayerDivStyle = this.textLayerDiv.style;
    }

    this.spinner = this.reader.querySelector(".spinner");
    this.totalPages = this.reader.querySelector('#totalPages');
    this.viewportStyle = this.viewport.style;
    this.viewportOutStyle = this.viewportOut.style;

    this.ctx = this.viewport.getContext('2d');

    this.SRC = el.src;

    // this.loadPDF();
    // this.renderPages();
    this.pageRendering = false;
    this.pageNumPending = null;

  };

  Reader.prototype.setSize = function(attrName, newVal) {

    this.WIDTH = this.viewportOut.offsetWidth;
    if (!this.HEIGHT)
      this.HEIGHT = this.viewportOut.offsetHeight;

    var width = this.WIDTH,
      height = this.HEIGHT;

    if (attrName === 'width') {
      width = newVal;
    }

    if (attrName === 'height') {
      height = newVal;
    }

    // this.element.style.width = this.reader.style.width = width + 'px';
    // this.element.style.height = this.reader.style.height = height + 'px';
    // this.element.style.height = this.reader.style.height = this.HEIGHT + 64 + 'px';

    // this.viewportOutStyle.width = width + 'px';
      if (!this.fitHeight) {
          this.viewportOutStyle.height = height + 'px';
      }

    this.spinner.style.top = (height - this.toolbarHeight) / 2 + 'px';
  };

  Reader.prototype.setSrc = function(src) {
    this.SRC = src;
  };

  Reader.prototype.setFitWidth = function(fitWidth) {
    this.fitWidth = fitWidth;
  };
  Reader.prototype.setFitHeight = function(fitHeight) {
      this.fitHeight = fitHeight;
  };

  Reader.prototype.queueRenderPage = function(num) {
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      this.renderPDF(num);
    }
  };

  Reader.prototype.loadPDF = function() {
    this.setSize();
    var self = this;

    PDFJS.getDocument({url: this.SRC, withCredentials: true}).then(function(pdf) {
      self.PDF = pdf;
      self.queueRenderPage(1);

      self.currentPage = 1;
      self.totalPages.innerHTML = self.PDF.numPages;
      self.totalPagesNum = self.PDF.numPages;
      self.currentZoomVal = self.fitZoomVal = self.widthZoomVal = 0;
      self.createDownloadLink();
    });
  };

  Reader.prototype.renderPages = function(pdf) {
    var self = this;
    self.viewportOut.innerHTML="";
    PDFJS.getDocument({url: this.SRC, withCredentials: true}).then(function(pdf) {
      self.PDF = pdf;

      for(var num = 1; num <= self.PDF.numPages; num++){
        pdf.getPage(num).then(self.renderPDF(num, null, true));
      }

      self.currentPage = 1;
      self.totalPages.innerHTML = self.PDF.numPages;
      self.totalPagesNum = self.PDF.numPages;
      if (!self.currentZoomVal)
        self.currentZoomVal = self.fitZoomVal = self.widthZoomVal = 0;
      self.createDownloadLink();
    });
  };

  Reader.prototype.renderPDF = function(pageNum, resize, isFull) {
    var self = this;
    self.pageRendering = true;
    self.spinner.active = true;
    this.PDF.getPage(pageNum).then(function(page) {
      var scaleW, scaleH, viewerViewport, scale, radians;
      radians = page.pageInfo.rotate * Math.PI / 180;

      self.pageW = Math.abs((page.view[2]*Math.cos(radians)) + (page.view[3]*Math.sin(radians)));
      self.pageH = Math.abs((page.view[3]*Math.cos(radians)) + (page.view[2]*Math.sin(radians)));

      if (self.currentZoomVal === 0 || !!resize) {
        scaleW = Math.round((self.WIDTH / self.pageW) * 100) / 100,
          scaleH = Math.round(((self.HEIGHT - self.toolbarHeight) / self.pageH) * 100) / 100,
          scale = Math.min(scaleH, scaleW);
        self.fitZoomVal = scale;
        self.widthZoomVal = self.WIDTH / self.pageW;
        self.currentZoomVal = self.fitWidth ? self.widthZoomVal : self.fitZoomVal;
      }
      if (!!resize) {
        self.zoomPage({
          target: self.zoomLvl
        });
      } else {
        scale = self.currentZoomVal;

        viewerViewport = page.getViewport(scale);

        self.ctx.height = viewerViewport.height;
        self.ctx.width = viewerViewport.width;

        self.pageW = self.pageW * scale;
        self.pageH = self.pageH * scale;

        self.setViewportPos();

        self.viewport.width = self.pageW;
        self.viewport.height = self.pageH;
        self.viewportStyle.width = self.pageW + 'px';
        if (!self.fitHeight) {
            self.viewportStyle.height = self.pageH + 'px';
        }

        if (self.enableTextSelection){
          self.textLayerDivStyle.width = self.pageW + 'px';
          self.textLayerDivStyle.height = self.pageH + 'px';
        }
        self.ctx.clearRect(0, 0, self.viewport.width, self.viewport.height);


        if (isFull){

          var wrapper = document.createElement('div');
          wrapper.setAttribute("style", "position: relative");
          var canvas = document.createElement('canvas');
          var textLayer = document.createElement('div');
          textLayer.setAttribute("style", "left: " + self.viewportStyle.left)

          textLayer.className = "textLayer";

          var ctx = canvas.getContext('2d');

          // canvas.height = viewerViewport.height;
          // canvas.width = viewerViewport.width;

          textLayer.height = viewerViewport.height;
          textLayer.width = viewerViewport.width;

          self.viewportOut.appendChild(wrapper);
          wrapper.appendChild(canvas);
          wrapper.appendChild(textLayer);

          page.render({
            canvasContext: ctx,
            viewport: viewerViewport
          });

          if (self.enableTextSelection){
            self.textLayerDiv.innerHTML="";
            page.getTextContent().then(function(textContent) {
              PDFJS.renderTextLayer({
                textContent: textContent,
                container: textLayer,
                pageIndex : pageNum,
                viewport: viewerViewport,
                textDivs: []
              });
            });
          }

        } else{

          var renderTask = page.render({
            canvasContext: self.ctx,
            viewport: viewerViewport
          });

          renderTask.promise.then(function () {
            self.pageRendering = false;
            self.spinner.active = false;
            if (self.pageNumPending !== null) {
              // New page rendering is pending
              self.renderPDF(self.pageNumPending);
              self.pageNumPending = null;
            }
          });
        }

        if (self.enableTextSelection){
          self.textLayerDiv.innerHTML="";
          page.getTextContent().then(function(textContent) {
            const task = PDFJS.renderTextLayer({
              textContent: textContent,
              container: self.textLayerDiv,
              pageIndex : pageNum,
              viewport: viewerViewport,
              textDivs: []
            })
            task.promise.then(() => {
                if (self.fitHeight && self.textLayerDiv && self.textLayerDiv.offsetHeight) {
                  setTimeout(() => {
                      const newHeight = Math.max(self.textLayerDiv.offsetHeight, 200) + self.toolbarHeight + 32 + 'px'
                      console.log('Setting pdf-element height to ' + newHeight)
                      self.element.style.height = newHeight
                  }, 300)
                }
            });
          });
        }
      }
    });
  };

  Reader.prototype.setViewportPos = function() {
    if (this.pageW < this.WIDTH)
      this.viewportStyle.left = (this.WIDTH - this.pageW) / 2 + 'px';
    else
      this.viewportStyle.left = 0;

    if (this.pageH < this.HEIGHT) {
      this.viewportStyle.top = this.fitHeight ? '0' : ((this.HEIGHT - this.pageH - this.toolbarHeight) / 2 + 'px');
      this.viewportStyle.topNum = (this.fitHeight ? 0 : Math.floor((this.HEIGHT - this.pageH - this.toolbarHeight) / 2)) + this.toolbarHeight;
      if (this.enableTextSelection){
        this.textLayerDivStyle.topNum = (this.fitHeight ? 0 : Math.floor((this.HEIGHT - this.pageH - this.toolbarHeight) / 2)) + this.toolbarHeight;
      }
    } else {
      this.viewportStyle.top = 0;
    }

    if (this.enableTextSelection) {
      this.textLayerDivStyle.left = this.viewportStyle.left;
      this.textLayerDivStyle.top = this.viewportStyle.top;
    }
  };

  Reader.prototype.changePDFSource = function(newSrc) {
    this.setSrc(newSrc);
    this.loadPDF();
  };

  Reader.prototype.zoomInOut = function(step) {
    // var step = 0.1;
    this.currentZoomVal = Math.round((Math.round(this.currentZoomVal * 10) / 10 + step) * 10) / 10;
    this.queueRenderPage(this.currentPage);
    // this.renderPages();
  };

  Reader.prototype.zoomIn = function() {
    var step = 0.1;
    this.currentZoomVal = Math.round((Math.round(this.currentZoomVal * 10) / 10 + step) * 10) / 10;
    this.queueRenderPage(this.currentPage);
    // this.renderPages();
  };

  Reader.prototype.zoomOut = function() {
    var step = -0.1;
    this.currentZoomVal = Math.round((Math.round(this.currentZoomVal * 10) / 10 + step) * 10) / 10;
    this.queueRenderPage(this.currentPage);
  };

  Reader.prototype.zoomPageFit = function() {
    this.currentZoomVal = this.fitZoomVal;
    this.queueRenderPage(this.currentPage);
  };

  Reader.prototype.zoomWidthFit = function() {
    this.currentZoomVal = this.widthZoomVal;
    this.queueRenderPage(this.currentPage);
  };

  Reader.prototype.getPageNum = function() {
    return this.PDF.numPages;
  };

  Reader.prototype.createDownloadLink = function() {
    var self = this;

    this.PDF.getData().then(function(data) {
      var blob = PDFJS.createBlob(data, 'application/pdf');

      self.downloadLink = URL.createObjectURL(blob);
    });
  };

  Reader.prototype.download = function(context) {
    var a = document.createElement('a'),
      filename = this.SRC.split('/');

    a.href = this.downloadLink;
    a.target = '_parent';

    if ('download' in a) {
      a.download = decodeURIComponent(filename[filename.length - 1]);
    }

    this.reader.appendChild(a);
    a.click();
    a.parentNode.removeChild(a);
  };

  window.Polymer.Reader = Reader;
})(window);
