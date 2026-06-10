/* ============================================================================
   v12 GOLD HERO ENGINE — modern three.js (PBR gold + room env + bloom + dust)
   Initialized ONLY on capable devices (see index.html capability gate).
   Renders a faceted "gold seal" gem in a reflective environment with a drifting
   gold-dust field and a single bloom pass. Scroll + mouse drive a cinematic
   camera. The crisp Sotheby's EST-1744 mark is composited in HTML on top.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function initGoldHero(canvas){
  const host = canvas.parentElement;
  let W = host.clientWidth, H = host.clientHeight;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03060f, 0.085);

  const camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  // --- Environment: realistic reflections on the gold (the key to "real metal")
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // --- Lights: warm gold key + cool rim so gold reads against the night
  const key = new THREE.SpotLight(0xffe6b0, 80, 30, Math.PI/5, 0.4, 1.2);
  key.position.set(5, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4a6cff, 2.2); rim.position.set(-6,-2,-4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x0a1838, 0.6));

  // --- The gold seal: a faceted gem (luxury cut), real PBR gold
  const gold = new THREE.MeshStandardMaterial({
    color:0xC79A3E, metalness:1.0, roughness:0.16,
    emissive:0x3a2a08, emissiveIntensity:0.35, envMapIntensity:1.4, flatShading:true
  });
  const seal = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), gold);
  seal.add(gem);
  // a thin gold ring orbiting the gem — heritage "seal" feel
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.045, 16, 160),
    new THREE.MeshStandardMaterial({ color:0xE5C36B, metalness:1, roughness:0.25, envMapIntensity:1.6 })
  );
  ring.rotation.x = Math.PI*0.5; seal.add(ring);
  scene.add(seal);

  // --- Gold dust: additive points drifting (light on metal, not glitter)
  const N = 1400;
  const pos = new Float32Array(N*3), seed = new Float32Array(N);
  for(let i=0;i<N;i++){
    const r = 3 + Math.random()*9, a = Math.random()*Math.PI*2, y=(Math.random()-0.5)*10;
    pos[i*3]=Math.cos(a)*r; pos[i*3+1]=y; pos[i*3+2]=Math.sin(a)*r - 2;
    seed[i]=Math.random()*Math.PI*2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color:0xF6E4A6, size:0.035, transparent:true, opacity:0.85,
    blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true
  }));
  scene.add(dust);

  // --- Post: a single restrained bloom = the "sparkle"
  const composer = new EffectComposer(renderer);
  composer.setSize(W,H); composer.setPixelRatio(Math.min(devicePixelRatio,2));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W,H), 0.62, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // --- Interaction
  const mouse = {x:0,y:0,tx:0,ty:0};
  addEventListener('pointermove', e=>{ mouse.tx=(e.clientX/innerWidth-0.5); mouse.ty=(e.clientY/innerHeight-0.5); }, {passive:true});
  let scrollP = 0; // 0..1 across the first viewport
  const onScroll = ()=>{ scrollP = Math.min(1, Math.max(0, scrollY / innerHeight)); };
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  function resize(){
    W=host.clientWidth; H=host.clientHeight;
    renderer.setSize(W,H); composer.setSize(W,H);
    camera.aspect=W/H; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let raf, alive=true;
  function frame(){
    if(!alive) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    // ease mouse
    mouse.x += (mouse.tx-mouse.x)*0.05; mouse.y += (mouse.ty-mouse.y)*0.05;

    if(!reduce){
      seal.rotation.y = t*0.18 + mouse.x*0.6;
      seal.rotation.x = Math.sin(t*0.13)*0.12 + mouse.y*0.35;
      ring.rotation.z = t*0.25;
      // dust drift
      const p = dust.geometry.attributes.position.array;
      for(let i=0;i<N;i++){ p[i*3+1]+=0.0016*Math.sin(t*0.4+seed[i]); }
      dust.geometry.attributes.position.needsUpdate = true;
      dust.rotation.y = t*0.02;
    }
    // scroll handoff: seal recedes + dims as you enter the content
    const s = 1 - scrollP*0.85;
    seal.scale.setScalar(s); seal.position.y = scrollP*1.6;
    camera.position.z = 7.4 + scrollP*3.2;
    bloom.strength = 0.62 * (1-scrollP*0.6);
    composer.render();
  }
  frame();

  return { destroy(){ alive=false; cancelAnimationFrame(raf); pmrem.dispose(); renderer.dispose(); } };
}
