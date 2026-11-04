(() => {
  const stage = document.querySelector('.portrait-stage');
  const image = stage.querySelector('img');
  const canvas = stage.querySelector('canvas');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  if (motion.matches || !pointer.matches) return;
  const gl = canvas.getContext('webgl', {alpha:true, premultipliedAlpha:false, antialias:false});
  if (!gl) return;
  let frame = 0, active = true;
  const target = [0,0], current = [0,0];
  function shader(type, source) {
    const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error('Shader compilation failed');
    return s;
  }
  function start() {
    try {
      const p=gl.createProgram();
      gl.attachShader(p,shader(gl.VERTEX_SHADER,'attribute vec2 a; varying vec2 uv; void main(){uv=vec2((a.x+1.0)*0.5,(1.0-a.y)*0.5);gl_Position=vec4(a,0.,1.);}'));
      gl.attachShader(p,shader(gl.FRAGMENT_SHADER,`precision mediump float;
        varying vec2 uv; uniform sampler2D photo; uniform vec2 mouse;
        float bump(vec2 p,vec2 c,vec2 size){vec2 q=(p-c)/size;return exp(-dot(q,q)*2.0);}
        void main(){
          // Soft facial depth field: nose nearest, face behind, shoulders farthest.
          float depth=.12+.44*bump(uv,vec2(.5,.44),vec2(.34,.36))+.33*bump(uv,vec2(.5,.53),vec2(.11,.17))+.12*bump(uv,vec2(.5,.80),vec2(.34,.25));
          vec2 pos=uv+mouse*(depth-.12)*.014;
          // Preserve forward gaze: damp displacement locally around both eyes.
          float eyes=max(bump(uv,vec2(.391,.405),vec2(.047,.032)),bump(uv,vec2(.608,.402),vec2(.047,.032)));
          pos-=mouse*(depth-.12)*.014*eyes*.85;
          if(pos.x<0.||pos.x>1.||pos.y<0.||pos.y>1.){gl_FragColor=vec4(0.);return;}
          gl_FragColor=texture2D(photo,pos);
        }`));
      gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS)) return;
      gl.useProgram(p);
      const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const a=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
      gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      const mouse=gl.getUniformLocation(p,'mouse');
      function draw(){
        frame=0;if(!active||document.hidden) return;
        const r=stage.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);
        const w=Math.round(r.width*d),h=Math.round(r.height*d);
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
        current[0]+=(target[0]-current[0])*.09;current[1]+=(target[1]-current[1])*.09;
        gl.uniform2f(mouse,current[0],current[1]);gl.drawArrays(gl.TRIANGLES,0,6);
        stage.classList.add('ready');
        if(Math.abs(target[0]-current[0])+Math.abs(target[1]-current[1])>.0005) frame=requestAnimationFrame(draw);
      }
      function schedule(){if(!frame&&active&&!document.hidden)frame=requestAnimationFrame(draw);}
      window.addEventListener('pointermove',e=>{target[0]=Math.max(-1,Math.min(1,e.clientX/innerWidth*2-1));target[1]=Math.max(-1,Math.min(1,e.clientY/innerHeight*2-1));schedule()},{passive:true});
      document.documentElement.addEventListener('pointerleave',()=>{target[0]=target[1]=0;schedule()});
      window.addEventListener('blur',()=>{target[0]=target[1]=0;schedule()});
      window.addEventListener('resize',schedule);
      document.addEventListener('visibilitychange',schedule);
      function preference(){active=!motion.matches&&pointer.matches;stage.classList.toggle('ready',active);if(!active){cancelAnimationFrame(frame);frame=0}else schedule()}
      motion.addEventListener('change',preference);pointer.addEventListener('change',preference);
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;cancelAnimationFrame(frame);stage.classList.remove('ready')});
      schedule();
    } catch {stage.classList.remove('ready');}
  }
  if(image.complete&&image.naturalWidth)start();else image.addEventListener('load',start,{once:true});
})();
