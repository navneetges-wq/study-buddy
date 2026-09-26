/* Lockin — 30s promo. Every frame is a pure function of time, so headless
   capture is exact and reproducible. The mark is the character: a loose dot is
   distraction, a dot snapped into the ring's gap is focus. */
const W = 1920, H = 1080, DUR = 30, FPS = 30;
const BG='#0b0d11', INK='#e8eaf0', DIM='#8a919f', FAINT='#5d636f',
      ACC='#7c8cff', BAD='#e07b7b', SURF='#13161d', LINE='rgba(255,255,255,.10)';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const ECZAR = 'Eczar, Georgia, serif';

const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const inOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const outC=t=>1-Math.pow(1-t,3);
const outQ=t=>1-Math.pow(1-t,5);
const inC =t=>t*t*t;
const back=t=>{const c=1.9;return 1+ (c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
/* local progress of a window, eased */
const seg=(t,a,b,e=x=>x)=>e(clamp((t-a)/(b-a)));
const hold=(t,a,b)=>t>=a&&t<b;

function alpha(ctx,a,fn){ if(a<=0.001)return; const o=ctx.globalAlpha; ctx.globalAlpha=o*clamp(a); fn(); ctx.globalAlpha=o; }

function txt(ctx,s,x,y,{size=40,font=SANS,weight=600,color=INK,align='left',
                        ls=0,base='alphabetic'}={}){
  ctx.save(); ctx.font=`${weight} ${size}px ${font}`; ctx.fillStyle=color;
  ctx.textAlign=align; ctx.textBaseline=base;
  if(ls) ctx.letterSpacing=`${ls}px`;
  ctx.fillText(s,x,y); ctx.restore();
}
function measure(ctx,s,{size=40,font=SANS,weight=600,ls=0}={}){
  ctx.save(); ctx.font=`${weight} ${size}px ${font}`;
  if(ls) ctx.letterSpacing=`${ls}px`;
  const w=ctx.measureText(s).width; ctx.restore(); return w;
}

/* ---- the mark ---------------------------------------------------------- */
/* Ring drawn from the gap outward so it can "assemble". gapHalf in degrees. */
function ring(ctx,cx,cy,R,sw,gapHalf,color,prog=1,glow=0){
  const a0=(-90+gapHalf)*Math.PI/180, sweep=(360-2*gapHalf)*Math.PI/180;
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=sw; ctx.lineCap='round';
  if(glow){ctx.shadowColor=color;ctx.shadowBlur=glow;}
  ctx.beginPath(); ctx.arc(cx,cy,R,a0,a0+sweep*clamp(prog)); ctx.stroke(); ctx.restore();
}
function dot(ctx,x,y,r,color,glow=0){
  ctx.save(); ctx.fillStyle=color;
  if(glow){ctx.shadowColor=color;ctx.shadowBlur=glow;}
  ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.restore();
}
/* the dot's home: top of the ring */
const home=(cx,cy,R)=>({x:cx,y:cy-R});

/* progress arc (the session dial) */
function dial(ctx,cx,cy,R,sw,p,color){
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=sw; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p)); ctx.stroke(); ctx.restore();
}

function card(ctx,x,y,w,h,r=18,fill=SURF,stroke=LINE){
  ctx.save(); ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
  ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
}
function vignette(ctx){
  const g=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.95);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.55)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
/* deterministic wander */
const wob=(t,s,a,b,c)=>Math.sin(t*a+s)*0.55+Math.sin(t*b+s*1.7)*0.32+Math.sin(t*c+s*2.3)*0.13;

/* ======================= S1  DRIFT  0 – 5.2 ============================== */
const DISTRACT=[['just one reel',2.15],['quick reply',2.75],['5 more minutes',3.35],
                ['check the group',3.85]];
function driftPos(t){
  return {x:W/2+wob(t,1.3,1.15,2.3,3.9)*420, y:H/2+wob(t,4.1,0.95,2.9,4.6)*250};
}
function s1(ctx,t){
  const p=driftPos(t);
  /* trail — the dot can't hold still */
  for(let i=12;i>0;i--){
    const q=driftPos(t-i*0.035);
    alpha(ctx,(1-i/12)*0.22*seg(t,0,0.6),()=>dot(ctx,q.x,q.y,16*(1-i/26),ACC));
  }
  const snap=seg(t,4.25,5.0,outQ);
  const R=250, hm=home(W/2,H/2,R);
  const dx=lerp(p.x,hm.x,snap), dy=lerp(p.y,hm.y,snap);
  alpha(ctx,seg(t,0,0.5),()=>dot(ctx,dx,dy,18,ACC,snap>0?34:18));

  alpha(ctx,seg(t,1.1,1.9)*(1-seg(t,4.2,4.6)),()=>
    txt(ctx,'11:48pm. Chapter 4, page 2.',W/2,H-200,{size:34,color:FAINT,align:'center',ls:1}));

  for(const [word,at] of DISTRACT){
    const a=seg(t,at,at+.35)*(1-seg(t,at+1.0,at+1.5));
    if(a<=0.001) continue;
    const q=driftPos(at+0.45);
    alpha(ctx,a*0.9,()=>txt(ctx,word,q.x,q.y-46,{size:30,color:DIM,align:'center',ls:.5,weight:500}));
  }
  /* the ring closes in */
  const asm=seg(t,3.9,4.9,outC);
  if(asm>0) alpha(ctx,1,()=>ring(ctx,W/2,H/2,R,26,26,INK,asm));
  /* the snap */
  const sh=seg(t,4.95,5.45);
  if(sh>0&&sh<1) alpha(ctx,(1-sh)*0.75,()=>{
    ctx.save(); ctx.strokeStyle=ACC; ctx.lineWidth=6*(1-sh);
    ctx.beginPath(); ctx.arc(W/2,H/2,R+sh*260,0,7); ctx.stroke(); ctx.restore();
  });
}

/* ======================= S2  LOCKED IN  5.2 – 8.2 ======================== */
function s2(ctx,t){
  const R=lerp(250,150,seg(t,5.5,6.6,inOut));
  const cy=lerp(H/2,H/2-70,seg(t,5.5,6.6,inOut));
  ring(ctx,W/2,cy,R,lerp(26,16,seg(t,5.5,6.6,inOut)),26,INK);
  const hm=home(W/2,cy,R);
  dot(ctx,hm.x,hm.y,lerp(18,11,seg(t,5.5,6.6,inOut)),ACC,20);
  const a=seg(t,6.5,7.2,outC);
  alpha(ctx,a,()=>txt(ctx,'LOCKIN',W/2,cy+R+150,{size:128,font:ECZAR,weight:700,
        color:INK,align:'center',ls:6}));
  alpha(ctx,seg(t,7.0,7.6),()=>txt(ctx,'Your partner in deep work.',W/2,cy+R+215,
        {size:34,color:DIM,align:'center',ls:1,weight:400}));
}

/* ======================= S3  THE SESSION  8.2 – 13.0 ===================== */
function s3(ctx,t){
  const cx=W/2, cy=H/2-40, R=200;
  const io=seg(t,8.2,8.7,outC)*(1-seg(t,12.6,13.0));
  alpha(ctx,io,()=>{
    ring(ctx,cx,cy,R,16,26,'rgba(255,255,255,.12)');
    const p=seg(t,8.7,12.2,inOut);
    dial(ctx,cx,cy,R,16,p*0.82,ACC);
    const hm=home(cx,cy,R); dot(ctx,hm.x,hm.y,11,ACC,16);
    const mins=Math.floor(lerp(0,38,p)), secs=Math.floor(lerp(0,12,p));
    txt(ctx,`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`,cx,cy+22,
        {size:96,color:INK,align:'center',ls:-2});
    txt(ctx,'FOCUSED',cx,cy+72,{size:22,color:FAINT,align:'center',ls:6,weight:500});
  });
  /* tab-leave ticks fire around the ring */
  const leaves=[9.5,10.0,10.45,10.95,11.4,11.85];
  leaves.forEach((at,i)=>{
    const a=seg(t,at,at+.18)*(1-seg(t,at+.9,at+1.4));
    if(a<=0.001) return;
    const ang=(-70+i*47)*Math.PI/180;
    alpha(ctx,a,()=>{
      ctx.save(); ctx.strokeStyle=BAD; ctx.lineWidth=7; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(ang)*(R+26),cy+Math.sin(ang)*(R+26));
      ctx.lineTo(cx+Math.cos(ang)*(R+58),cy+Math.sin(ang)*(R+58));
      ctx.stroke(); ctx.restore();
    });
  });
  const n=leaves.filter(a=>t>=a).length;
  alpha(ctx,seg(t,9.5,9.9)*(1-seg(t,12.6,13.0)),()=>{
    txt(ctx,'TAB LEAVES',cx,cy+R+150,{size:22,color:FAINT,align:'center',ls:6,weight:500});
    txt(ctx,String(n),cx,cy+R+230,{size:72,color:BAD,align:'center',ls:-1,font:ECZAR,weight:700});
  });
  alpha(ctx,seg(t,8.5,9.1)*(1-seg(t,9.4,9.8)),()=>
    txt(ctx,'Start a session and everything else disappears.',cx,H-130,
        {size:38,color:DIM,align:'center',ls:.5,weight:500}));
}

/* ======================= S4  AUTOPSY  13.0 – 18.4 ======================== */
const ROWS=[['Planned','45m',false],['Actually focused','38m 12s',false],
            ['Tab leaves','6',true],['Time away','4m 31s',true],
            ['Distractions logged','3',true]];
function s4(ctx,t){
  const io=seg(t,13.0,13.6,outC)*(1-seg(t,18.0,18.4));
  const cw=620, ch=560, cx0=W/2-cw-70, cy0=H/2-ch/2;
  alpha(ctx,io,()=>{
    const grow=seg(t,13.0,13.8,outC);
    card(ctx,cx0,cy0+ (1-grow)*40, cw, ch*grow, 20);
    if(grow<0.98) return;
    txt(ctx,'SESSION AUTOPSY',cx0+42,cy0+60,{size:22,color:FAINT,ls:6,weight:500});
    ctx.save(); ctx.strokeStyle=LINE; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(cx0,cy0+92); ctx.lineTo(cx0+cw,cy0+92); ctx.stroke(); ctx.restore();
    const sc=Math.floor(seg(t,13.8,15.0,outC)*82);
    txt(ctx,String(sc),cx0+42,cy0+215,{size:150,font:ECZAR,weight:700,color:ACC,ls:-3});
    const sw2=measure(ctx,String(sc),{size:150,font:ECZAR,weight:700,ls:-3});
    txt(ctx,'/100',cx0+58+sw2,cy0+215,{size:34,color:FAINT});
    txt(ctx,'FOCUS SCORE',cx0+58+sw2,cy0+250,{size:19,color:FAINT,ls:5,weight:500});
    ROWS.forEach(([k,v,bad],i)=>{
      const a=seg(t,14.6+i*0.16,14.9+i*0.16,outC);
      alpha(ctx,a,()=>{
        const y=cy0+300+i*52;
        ctx.save(); ctx.strokeStyle=LINE; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(cx0+42,y-26); ctx.lineTo(cx0+cw-42,y-26); ctx.stroke(); ctx.restore();
        txt(ctx,k,cx0+42,y+8,{size:28,color:DIM,weight:400});
        txt(ctx,v,cx0+cw-42,y+8,{size:28,color:bad?BAD:INK,align:'right'});
      });
    });
  });
  const tx=W/2-30;
  alpha(ctx,seg(t,15.6,16.2,outC)*io,()=>{
    txt(ctx,'Most timers tell you',tx,H/2-90,{size:44,color:FAINT,weight:400});
    txt(ctx,"time's up.",tx,H/2-30,{size:44,color:FAINT,weight:400});
    /* strike the claim being rejected, measured against its own line */
    const sp=seg(t,16.3,16.8,outC);
    if(sp>0){ const w=measure(ctx,"time's up.",{size:44,weight:400});
      ctx.save(); ctx.strokeStyle=BAD; ctx.lineWidth=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(tx,H/2-45); ctx.lineTo(tx+w*sp,H/2-45);
      ctx.stroke(); ctx.restore(); }
  });
  alpha(ctx,seg(t,16.9,17.5,outC)*io,()=>{
    txt(ctx,'Lockin tells you',tx,H/2+70,{size:58,color:INK,font:ECZAR,weight:700,ls:1});
    txt(ctx,'what happened.',tx,H/2+140,{size:58,color:INK,font:ECZAR,weight:700,ls:1});
  });
}

/* ======================= S5  HANDS-FREE  18.4 – 23.0 ===================== */
function s5(ctx,t){
  const cx=W/2, cy=H/2-60, io=seg(t,18.4,18.9,outC)*(1-seg(t,22.6,23.0));
  alpha(ctx,io,()=>{
    /* voice rings radiate out of the mark */
    for(let i=0;i<4;i++){
      const ph=((t-18.6)*0.55+i*0.25)%1;
      if(ph<0) continue;
      alpha(ctx,(1-ph)*0.35,()=>{
        ctx.save(); ctx.strokeStyle=ACC; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(cx,cy,120+ph*320,0,7); ctx.stroke(); ctx.restore();
      });
    }
    const pulse=1+Math.sin(t*9)*0.03;
    ring(ctx,cx,cy,110*pulse,14,26,INK);
    const hm=home(cx,cy,110*pulse); dot(ctx,hm.x,hm.y,10,ACC,18);
  });
  const say='"Lockin, how am I doing?"';
  const n=Math.floor(seg(t,19.1,20.2)*say.length);
  alpha(ctx,io*seg(t,19.1,19.3),()=>
    txt(ctx,say.slice(0,n),cx,cy+250,{size:52,color:INK,align:'center',ls:0,weight:600}));
  const rep='Thirty-eight minutes focused. Six tab leaves.';
  const m=Math.floor(seg(t,20.5,21.8)*rep.length);
  alpha(ctx,io*seg(t,20.5,20.7),()=>
    txt(ctx,rep.slice(0,m),cx,cy+320,{size:34,color:ACC,align:'center',weight:400}));
  alpha(ctx,io*seg(t,21.9,22.4,outC),()=>
    txt(ctx,'22 COMMANDS. NO KEYBOARD.',cx,H-120,
        {size:46,font:ECZAR,weight:700,color:INK,align:'center',ls:3}));
}

/* ======================= S6  DUEL  23.0 – 27.4 =========================== */
function s6(ctx,t){
  const io=seg(t,23.0,23.5,outC)*(1-seg(t,27.0,27.4));
  const split=seg(t,23.0,23.9,inOut), cy=H/2-40;
  const lx=lerp(W/2,W/2-330,split), rx=lerp(W/2,W/2+330,split);
  alpha(ctx,io,()=>{
    [[lx,'You',82,false],[rx,'Aisha',74,true]].forEach(([x,name,target,away])=>{
      const gone=away&&t>25.1&&t<26.0;
      const col=gone?BAD:INK;
      ring(ctx,x,cy,140,16,26,'rgba(255,255,255,.12)');
      dial(ctx,x,cy,140,16,seg(t,23.6,26.6,inOut)*(away?0.74:0.82),gone?BAD:ACC);
      const hm=home(x,cy,140); dot(ctx,hm.x,hm.y,11,gone?BAD:ACC,gone?26:14);
      const v=Math.floor(seg(t,23.6,26.6,inOut)*target);
      txt(ctx,String(v),x,cy+28,{size:104,font:ECZAR,weight:700,color:gone?BAD:ACC,align:'center',ls:-2});
      txt(ctx,name,x,cy-190,{size:30,color:gone?BAD:DIM,align:'center',ls:2,weight:500});
      if(gone) txt(ctx,'left their tab',x,cy+230,{size:26,color:BAD,align:'center',weight:500});
    });
  });
  alpha(ctx,io*seg(t,24.0,24.5,outC),()=>
    txt(ctx,'ONE LINK. TWO TIMERS. ONE WINNER.',W/2,H-140,
        {size:52,font:ECZAR,weight:700,color:INK,align:'center',ls:3}));
  alpha(ctx,io*seg(t,26.5,26.9,outC),()=>{
    txt(ctx,'HEAD TO HEAD',W/2,190,{size:22,color:FAINT,align:'center',ls:6,weight:500});
    txt(ctx,'4 – 2',W/2,265,{size:66,font:ECZAR,weight:700,color:INK,align:'center',ls:2});
  });
}

/* ======================= S7  CLOSE  27.4 – 30 ============================ */
function s7(ctx,t){
  const j=seg(t,27.4,28.2,inOut), cy=H/2-40;
  const lx=lerp(W/2-330,W/2,j), rx=lerp(W/2+330,W/2,j);
  const R=lerp(140,170,j);
  if(j<1){
    alpha(ctx,1-j*0.4,()=>{ring(ctx,lx,cy,R,16,26,INK);ring(ctx,rx,cy,R,16,26,INK);});
  }
  const a=seg(t,28.0,28.5,outC);
  alpha(ctx,Math.max(a,j>=1?1:0),()=>{
    ring(ctx,W/2,cy,R,18,26,INK);
    const hm=home(W/2,cy,R);
    const pl=1+Math.sin((t-28.6)*6)*0.12*clamp(seg(t,28.6,29.4));
    dot(ctx,hm.x,hm.y,13*pl,ACC,26);
  });
  alpha(ctx,seg(t,28.4,28.9,outC),()=>
    txt(ctx,'LOCKIN',W/2,cy+R+150,{size:110,font:ECZAR,weight:700,color:INK,align:'center',ls:6}));
  alpha(ctx,seg(t,28.8,29.3,outC),()=>
    txt(ctx,'navneetges-wq.github.io/study-buddy',W/2,cy+R+215,
        {size:32,color:ACC,align:'center',weight:600}));
  alpha(ctx,seg(t,29.1,29.6,outC),()=>
    txt(ctx,'No account.  No server.  Nothing leaves your laptop.',W/2,cy+R+272,
        {size:26,color:FAINT,align:'center',weight:400,ls:.5}));
}

/* ======================= dispatch ======================================== */
function drawFrame(ctx,t){
  ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
  if(t<5.45) s1(ctx,t);
  if(t>=5.2&&t<8.4) s2(ctx,t);
  if(t>=8.2&&t<13.0) s3(ctx,t);
  if(t>=13.0&&t<18.4) s4(ctx,t);
  if(t>=18.4&&t<23.0) s5(ctx,t);
  if(t>=23.0&&t<27.4) s6(ctx,t);
  if(t>=27.4) s7(ctx,t);
  vignette(ctx);
  /* a short fade up and out */
  const f=1-seg(t,0,0.5)+seg(t,29.6,30);
  if(f>0){ctx.fillStyle=BG;ctx.globalAlpha=clamp(f);ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
}
