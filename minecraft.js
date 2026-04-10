// ============================================================
// PULSESHIP — minecraft.js  (2D Craft World)
// ============================================================

(function initMinecraft(){
  const canvas = document.getElementById('mc-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('minecraft-container');

  // ── Constants ───────────────────────────────────────────
  const TILE = 20, COLS = 40, ROWS = 20;
  const GRAVITY = 0.4, JUMP = -8, SPEED = 3;

  // Block types
  const T = {
    AIR:0, GRASS:1, DIRT:2, STONE:3, WOOD:4, LEAVES:5,
    SAND:6, WATER:7, COAL:8, IRON:9, GOLD:10, DIAMOND:11
  };
  const COLORS = {
    [T.GRASS]:'#5a8c2e', [T.DIRT]:'#8B5E3C', [T.STONE]:'#888',
    [T.WOOD]:'#6B4423', [T.LEAVES]:'#2d6e1e', [T.SAND]:'#dcc87a',
    [T.WATER]:'rgba(30,120,255,.55)', [T.COAL]:'#333', [T.IRON]:'#aaa',
    [T.GOLD]:'#f5c518', [T.DIAMOND]:'#55eeff'
  };
  const NAMES = {[T.GRASS]:'Grass',[T.DIRT]:'Dirt',[T.STONE]:'Stone',[T.WOOD]:'Wood',[T.LEAVES]:'Leaves',[T.SAND]:'Sand',[T.COAL]:'Coal',[T.IRON]:'Iron',[T.GOLD]:'Gold',[T.DIAMOND]:'Diamond'};

  // ── World gen ─────────────────────────────────────────────
  const world = [];
  function noise(x){ return Math.sin(x*0.3)*3+Math.sin(x*0.7)*2+Math.sin(x*0.1)*5; }

  for(let c=0;c<COLS;c++){
    world[c]=[];
    for(let r=0;r<ROWS;r++) world[c][r]=T.AIR;
    const surfRow = Math.floor(ROWS*0.55 + noise(c));
    for(let r=0;r<ROWS;r++){
      if(r===surfRow) world[c][r]=T.GRASS;
      else if(r===surfRow+1||r===surfRow+2) world[c][r]=T.DIRT;
      else if(r>surfRow+2){
        const ore=Math.random();
        if(ore<0.02) world[c][r]=T.DIAMOND;
        else if(ore<0.05) world[c][r]=T.GOLD;
        else if(ore<0.1)  world[c][r]=T.IRON;
        else if(ore<0.18) world[c][r]=T.COAL;
        else world[c][r]=T.STONE;
      }
    }
    // Trees
    if(c%7===3&&surfRow>2){
      for(let h=1;h<=4;h++) world[c][surfRow-h]=T.WOOD;
      for(let dc=-2;dc<=2;dc++) for(let dr=-2;dr<=0;dr++){
        const cc=c+dc,rr=surfRow-4+dr;
        if(cc>=0&&cc<COLS&&world[cc][rr]===T.AIR) world[cc][rr]=T.LEAVES;
      }
    }
    // Water pools
    if(c>5&&c<COLS-5&&surfRow>=Math.floor(ROWS*0.6)){
      world[c][surfRow]=T.WATER;
    }
    // Sand near water
    if(c>4&&c<COLS-4&&noise(c)>4){
      world[c][surfRow]=T.SAND;
    }
  }

  // ── Player ────────────────────────────────────────────────
  const player = {x:3*TILE, y:0, vy:0, onGround:false, facing:1};
  // Find spawn
  for(let r=0;r<ROWS;r++){if(world[3][r]!==T.AIR){player.y=(r-1)*TILE;break;}}

  // ── Inventory ─────────────────────────────────────────────
  const INV_SIZE = 6;
  const inv = [T.DIRT,T.GRASS,T.STONE,T.WOOD,T.SAND,T.LEAVES];
  let selSlot = 0;

  // ── Camera ────────────────────────────────────────────────
  let camX = 0;

  // ── Input ─────────────────────────────────────────────────
  const mcKeys = window.mcKeys = {left:false,right:false,jump:false};
  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='a') mcKeys.left=true;
    if(e.key==='ArrowRight'||e.key==='d') mcKeys.right=true;
    if(e.key==='ArrowUp'||e.key==='w'||e.key===' ') mcKeys.jump=true;
    if(e.key>='1'&&e.key<='6') selSlot=parseInt(e.key)-1;
  });
  document.addEventListener('keyup',e=>{
    if(e.key==='ArrowLeft'||e.key==='a') mcKeys.left=false;
    if(e.key==='ArrowRight'||e.key==='d') mcKeys.right=false;
    if(e.key==='ArrowUp'||e.key==='w'||e.key===' ') mcKeys.jump=false;
  });

  // Click to mine/place
  canvas.addEventListener('click',e=>{
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
    const mx=(e.clientX-rect.left)*scaleX+camX, my=(e.clientY-rect.top)*scaleY;
    const col=Math.floor(mx/TILE), row=Math.floor(my/TILE);
    if(col<0||col>=COLS||row<0||row>=ROWS) return;
    const dist=Math.hypot((col+.5)*TILE-camX-(player.x-camX+TILE*.5),(row+.5)*TILE-(player.y+TILE*.5));
    if(dist>TILE*4) return;
    if(world[col][row]!==T.AIR&&world[col][row]!==T.WATER){
      const mined=world[col][row];
      // Add to inventory if slot empty or matching
      const idx=inv.indexOf(T.AIR);const matIdx=inv.indexOf(mined);
      if(matIdx>=0){}else if(idx>=0)inv[idx]=mined;
      world[col][row]=T.AIR;
    } else if(world[col][row]===T.AIR){
      if(inv[selSlot]!==T.AIR) world[col][row]=inv[selSlot];
    }
  });

  // Toolbar buttons
  function buildToolbar(){
    const tb=document.getElementById('mc-toolbar'); if(!tb) return;
    tb.innerHTML=inv.map((t,i)=>`
      <div onclick="window._mcSelSlot(${i})" style="width:28px;height:28px;background:${t!==T.AIR?COLORS[t]:'rgba(0,0,0,.4)'};border:2px solid ${i===selSlot?'#fff':'#555'};border-radius:3px;cursor:pointer;font-size:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:monospace" title="${NAMES[t]||''}">
        ${t!==T.AIR?'':'?'}
      </div>`).join('');
  }
  window._mcSelSlot=(i)=>{selSlot=i;buildToolbar();};

  // ── Collision ──────────────────────────────────────────────
  function solid(col,row){if(col<0||col>=COLS||row<0||row>=ROWS)return true;const t=world[col][row];return t!==T.AIR&&t!==T.WATER&&t!==T.LEAVES;}

  // ── Resize canvas ─────────────────────────────────────────
  function resize(){canvas.width=container.clientWidth||300;canvas.height=280;}
  resize(); new ResizeObserver(resize).observe(container);

  // ── Game loop ─────────────────────────────────────────────
  function update(){
    // Movement
    if(mcKeys.left){player.x-=SPEED;player.facing=-1;}
    if(mcKeys.right){player.x+=SPEED;player.facing=1;}
    if(mcKeys.jump&&player.onGround){player.vy=JUMP;player.onGround=false;}

    // Gravity
    player.vy+=GRAVITY; player.y+=player.vy; player.onGround=false;

    // Horizontal bounds
    player.x=Math.max(0,Math.min(player.x,(COLS-1)*TILE));

    // Vertical collision
    const col=Math.floor((player.x+6)/TILE);
    const col2=Math.floor((player.x+TILE-7)/TILE);
    const rowBottom=Math.floor((player.y+TILE-1)/TILE);
    const rowTop=Math.floor(player.y/TILE);

    if(player.vy>0){
      if(solid(col,rowBottom)||solid(col2,rowBottom)){player.y=rowBottom*TILE-TILE;player.vy=0;player.onGround=true;}
    } else if(player.vy<0){
      if(solid(col,rowTop)||solid(col2,rowTop)){player.y=(rowTop+1)*TILE;player.vy=0;}
    }

    // Water slowdown
    const tileUnder=world[Math.floor((player.x+TILE/2)/TILE)]?.[rowBottom];
    if(tileUnder===T.WATER){player.vy=Math.min(player.vy,.5);}

    // Camera
    const targetCam=player.x-canvas.width/2+TILE/2;
    camX=Math.max(0,Math.min(targetCam,(COLS*TILE)-canvas.width));
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Sky gradient
    const sky=ctx.createLinearGradient(0,0,0,canvas.height);
    sky.addColorStop(0,'#87CEEB'); sky.addColorStop(1,'#d0eaff');
    ctx.fillStyle=sky; ctx.fillRect(0,0,canvas.width,canvas.height);

    // World tiles
    const startCol=Math.floor(camX/TILE), endCol=Math.min(COLS,startCol+Math.ceil(canvas.width/TILE)+2);
    for(let c=startCol;c<endCol;c++){
      for(let r=0;r<ROWS;r++){
        const t=world[c][r]; if(t===T.AIR) continue;
        const x=c*TILE-camX, y=r*TILE;
        ctx.fillStyle=COLORS[t]||'#888';
        ctx.fillRect(x,y,TILE,TILE);
        // Grid lines
        ctx.strokeStyle='rgba(0,0,0,.1)'; ctx.lineWidth=0.5;
        ctx.strokeRect(x,y,TILE,TILE);
        // Grass top detail
        if(t===T.GRASS){ctx.fillStyle='#6dbf33';ctx.fillRect(x,y,TILE,3);}
        // Ore dots
        if(t===T.COAL||t===T.IRON||t===T.GOLD||t===T.DIAMOND){
          ctx.fillStyle=t===T.COAL?'#222':t===T.IRON?'#fff':t===T.GOLD?'#ffe000':'#00fff5';
          ctx.beginPath();ctx.arc(x+TILE/2,y+TILE/2,3,0,Math.PI*2);ctx.fill();
        }
      }
    }

    // Player (simple pixel person)
    const px=player.x-camX, py=player.y;
    // Body
    ctx.fillStyle='#4a90d9'; ctx.fillRect(px+3,py+8,TILE-6,TILE-10);
    // Head
    ctx.fillStyle='#FDBCB4'; ctx.fillRect(px+4,py+1,TILE-8,8);
    // Eyes
    ctx.fillStyle='#333'; ctx.fillRect(px+(player.facing>0?9:5),py+3,2,2);
    // Legs (animate)
    const legOff=player.onGround?Math.sin(Date.now()*0.01)*2:0;
    ctx.fillStyle='#2c5282';
    ctx.fillRect(px+3,py+TILE-7,TILE/2-4,7+legOff);
    ctx.fillRect(px+TILE/2,py+TILE-7,TILE/2-4,7-legOff);

    buildToolbar();
  }

  function loop(){update();draw();requestAnimationFrame(loop);}
  loop();
})();