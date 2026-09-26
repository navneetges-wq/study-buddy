/* Lockin — 30s feature advertisement. Faceless and product-only: no people, no
   mascot, nothing but the app's own geometry and interface.
   Every frame is a pure function of time so headless capture is exact. */
const W=1920,H=1080,DUR=30,FPS=30;
const BG='#0b0d11',INK='#e8eaf0',DIM='#9aa1af',FAINT='#6d7483',
      ACC='#7c8cff',BAD='#e07b7b',GOOD='#5ec9a0',SURF='#13161d',LINE='rgba(255,255,255,.10)';
const SANS='"Helvetica Neue", Helvetica, Arial, sans-serif', ECZAR='Eczar, Georgia, serif';

const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const inOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const outC=t=>1-Math.pow(1-t,3);
const outQ=t=>1-Math.pow(1-t,5);
const seg=(t,a,b,e=x=>x)=>e(clamp((t-a)/(b-a)));
function alpha(ctx,a,fn){if(a<=.001)return;const o=ctx.globalAlpha;ctx.globalAlpha=o*clamp(a);fn();ctx.globalAlpha=o;}
function txt(ctx,s,x,y,{size=40,font=SANS,weight=600,color=INK,align='left',ls=0}={}){
  ctx.save();ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;
  ctx.textBaseline='alphabetic';if(ls)ctx.letterSpacing=`${ls}px`;ctx.fillText(s,x,y);ctx.restore();}
function meas(ctx,s,{size=40,font=SANS,weight=600,ls=0}={}){
  ctx.save();ctx.font=`${weight} ${size}px ${font}`;if(ls)ctx.letterSpacing=`${ls}px`;
  const w=ctx.measureText(s).width;ctx.restore();return w;}
function card(ctx,x,y,w,h,r=18,fill=SURF,stroke=LINE,lw=2){
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();ctx.restore();}
function ring(ctx,cx,cy,R,sw,gapHalf,color,prog=1,glow=0){
  const a0=(-90+gapHalf)*Math.PI/180,sw2=(360-2*gapHalf)*Math.PI/180;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=sw;ctx.lineCap='round';
  if(glow){ctx.shadowColor=color;ctx.shadowBlur=glow;}
  ctx.beginPath();ctx.arc(cx,cy,R,a0,a0+sw2*clamp(prog));ctx.stroke();ctx.restore();}
function dot(ctx,x,y,r,c,glow=0){ctx.save();ctx.fillStyle=c;
  if(glow){ctx.shadowColor=c;ctx.shadowBlur=glow;}ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.restore();}
function dial(ctx,cx,cy,R,sw,p,c){ctx.save();ctx.strokeStyle=c;ctx.lineWidth=sw;ctx.lineCap='round';
  ctx.beginPath();ctx.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p));ctx.stroke();ctx.restore();}
function mark(ctx,cx,cy,R,sw,prog=1,dotScale=1){
  ring(ctx,cx,cy,R,sw,26,INK,prog);
  if(prog>.92)dot(ctx,cx,cy-R,sw*0.82*dotScale,ACC,18);}

/* chapter label + the ad's own progress hairline */
function chapter(ctx,t,label,a,b){
  const s=seg(t,a,a+.45,outC)*(1-seg(t,b-.3,b));
  alpha(ctx,s,()=>{
    txt(ctx,label,120,128,{size:26,color:ACC,ls:9,weight:600});
    ctx.save();ctx.strokeStyle='rgba(124,140,255,.35)';ctx.lineWidth=3;ctx.beginPath();
    ctx.moveTo(120,152);ctx.lineTo(120+meas(ctx,label,{size:26,ls:9})*seg(t,a,a+.8,outC),152);
    ctx.stroke();ctx.restore();});
}
function progressbar(ctx,t){
  ctx.save();ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(0,H-6,W,6);
  ctx.fillStyle=ACC;ctx.fillRect(0,H-6,W*(t/DUR),6);ctx.restore();}
function vignette(ctx){const g=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.98);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}

/* ===================== S1  BRAND  0 – 3.0 ============================== */
function s1(ctx,t){
  const cy=H/2-30, R=lerp(120,104,seg(t,.2,1.2,outC));
  mark(ctx,W/2,cy,R,14,seg(t,.1,.85,outQ));
  alpha(ctx,seg(t,.75,1.3,outC),()=>
    txt(ctx,'LOCKIN',W/2,cy+R+140,{size:112,font:ECZAR,weight:700,align:'center',ls:6}));
  alpha(ctx,seg(t,1.15,1.6),()=>
    txt(ctx,'Your partner in deep work.',W/2,cy+R+196,{size:32,color:DIM,align:'center',weight:400}));
  alpha(ctx,seg(t,1.9,2.4)*(1-seg(t,2.75,3.0)),()=>
    txt(ctx,'A focus timer that answers back.',W/2,cy+R+272,{size:30,color:FAINT,align:'center',weight:500,ls:1}));
}

/* ===================== S2  HANDS-FREE  3.0 – 11.2 ====================== */
/* the screen goes dark on purpose: the point is that you don't need it */
function wave(ctx,cx,cy,t,amp,n=46,spread=560){
  for(let i=0;i<n;i++){
    const f=i/(n-1), x=cx-spread+f*spread*2;
    const env=Math.sin(f*Math.PI);
    const h=(6+Math.abs(Math.sin(t*7.3+i*.55)*Math.sin(t*3.1+i*.21))*96*env)*amp;
    ctx.fillStyle=`rgba(124,140,255,${.35+.5*env})`;
    ctx.fillRect(x-3,cy-h/2,6,h);
  }
}
function s2(ctx,t){
  chapter(ctx,t,'HANDS-FREE',3.0,11.0);
  const dark=seg(t,3.05,3.6,inOut)*(1-seg(t,10.4,11.1));
  alpha(ctx,dark*0.93,()=>{ctx.fillStyle='#000';ctx.fillRect(0,170,W,H-176);});
  const cy=H/2-40;
  const io=seg(t,3.18,3.7,outC)*(1-seg(t,10.6,11.1));
  alpha(ctx,io,()=>{
    const pulse=1+Math.sin(t*8)*.04;
    ring(ctx,W/2,cy-150,54*pulse,9,26,INK); dot(ctx,W/2,cy-150-54*pulse,8,ACC,20);
    wave(ctx,W/2,cy-10,t,seg(t,3.5,4.1));
  });
  /* two exchanges, one after the other in the same place, each clearing
     before the next — otherwise they stack into the headline */
  const say=(str,x0,x1,out,y,col,size)=>{
    const n=Math.floor(seg(t,x0,x1)*str.length);
    const a=io*seg(t,x0,x0+.15)*(1-seg(t,out,out+.3));
    alpha(ctx,a,()=>txt(ctx,str.slice(0,n),W/2,y,{size,color:col,align:'center',weight:600}));
  };
  say('"Lockin, start 45 minutes."',4.3,5.2,6.45,cy+130,INK,50);
  say('Starting 45 minutes.',       5.5,6.1,6.45,cy+192,ACC,32);
  say('"How am I doing?"',          6.9,7.5,8.85,cy+130,INK,50);
  say('Twelve minutes focused. No distractions.',7.8,8.7,8.85,cy+192,ACC,32);
  alpha(ctx,io*seg(t,9.0,9.6,outC),()=>
    txt(ctx,'RUN A WHOLE SESSION',W/2,H-272,{size:56,font:ECZAR,weight:700,align:'center',ls:3}));
  alpha(ctx,io*seg(t,9.32,9.9,outC),()=>
    txt(ctx,'WITHOUT LOOKING AT THE SCREEN.',W/2,H-200,{size:56,font:ECZAR,weight:700,align:'center',ls:3}));
  alpha(ctx,io*seg(t,9.95,10.4),()=>
    txt(ctx,'It answers out loud. 22 commands, not one of them a keyboard.',
        W/2,H-132,{size:28,color:DIM,align:'center',weight:400}));
}

/* ===================== S3  AUTOPSY  11.2 – 17.6 ======================== */
const ROWS=[['Planned','45m',0],['Actually focused','38m 12s',0],
            ['Tab leaves','6',1],['Time away','4m 31s',1],['Distractions logged','3',1]];
function s3(ctx,t){
  chapter(ctx,t,'SESSION AUTOPSY',11.2,17.5);
  const io=seg(t,11.4,12.0,outC)*(1-seg(t,17.2,17.6));
  const cw=640,ch=540,x0=170,y0=H/2-ch/2+20;
  alpha(ctx,io,()=>{
    const g=seg(t,11.4,12.1,outC);
    card(ctx,x0,y0+(1-g)*50,cw,ch*g,22);
    if(g<.97)return;
    txt(ctx,'SESSION AUTOPSY',x0+44,y0+62,{size:21,color:FAINT,ls:6});
    ctx.save();ctx.strokeStyle=LINE;ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(x0,y0+94);ctx.lineTo(x0+cw,y0+94);ctx.stroke();ctx.restore();
    const sc=Math.floor(seg(t,12.1,13.4,outC)*82);
    txt(ctx,String(sc),x0+44,y0+218,{size:150,font:ECZAR,weight:700,color:ACC,ls:-3});
    const w=meas(ctx,String(sc),{size:150,font:ECZAR,weight:700,ls:-3});
    txt(ctx,'/100',x0+60+w,y0+218,{size:32,color:FAINT});
    txt(ctx,'FOCUS SCORE',x0+60+w,y0+252,{size:18,color:FAINT,ls:5});
    ROWS.forEach(([k,v,bad],i)=>alpha(ctx,seg(t,13.0+i*.15,13.3+i*.15,outC),()=>{
      const y=y0+300+i*50;
      ctx.save();ctx.strokeStyle=LINE;ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(x0+44,y-26);ctx.lineTo(x0+cw-44,y-26);ctx.stroke();ctx.restore();
      txt(ctx,k,x0+44,y+6,{size:27,color:DIM,weight:400});
      txt(ctx,v,x0+cw-44,y+6,{size:27,color:bad?BAD:INK,align:'right'});
    }));
  });
  const tx=x0+cw+120;
  alpha(ctx,io*seg(t,14.4,15.0,outC),()=>{
    txt(ctx,"It doesn't say",tx,H/2-70,{size:62,font:ECZAR,weight:700,ls:1});
    txt(ctx,'"done".',tx,H/2+10,{size:62,font:ECZAR,weight:700,color:FAINT,ls:1});});
  alpha(ctx,io*seg(t,15.6,16.2,outC),()=>{
    txt(ctx,'It says what',tx,H/2+120,{size:62,font:ECZAR,weight:700,ls:1});
    txt(ctx,'happened.',tx,H/2+200,{size:62,font:ECZAR,weight:700,color:ACC,ls:1});});
}

/* ===================== S4  DUEL  17.6 – 23.8 =========================== */
function s4(ctx,t){
  chapter(ctx,t,'FOCUS DUEL',17.6,23.7);
  const io=seg(t,17.8,18.3,outC)*(1-seg(t,23.4,23.8));
  const cy=H/2-20;
  /* the invite link flies from one side to the other */
  const fly=seg(t,18.2,19.0,inOut);
  alpha(ctx,io*(1-seg(t,19.2,19.6)),()=>{
    const x=lerp(W/2-330,W/2+330,fly);
    card(ctx,x-250,cy-340,500,82,16,'#171b22','rgba(124,140,255,.55)',3);
    txt(ctx,'lockin.app/r/9f2c',x,cy-297,{size:34,color:ACC,align:'center',weight:600});
    txt(ctx,'send one link \u2014 no account, either side',x,cy-268,
        {size:20,color:FAINT,align:'center',weight:400,ls:.5});
  });
  alpha(ctx,io*seg(t,18.9,19.5,outC),()=>{
    [[W/2-330,'You',82,false],[W/2+330,'Aisha',74,true]].forEach(([x,name,target,away])=>{
      const gone=away&&t>21.2&&t<22.2, col=gone?BAD:ACC;
      ring(ctx,x,cy,132,15,26,'rgba(255,255,255,.12)');
      dial(ctx,x,cy,132,15,seg(t,19.8,22.8,inOut)*(away?.74:.82),col);
      dot(ctx,x,cy-132,12,col,gone?26:14);
      const v=Math.floor(seg(t,19.8,22.8,inOut)*target);
      txt(ctx,String(v),x,cy+26,{size:98,font:ECZAR,weight:700,color:col,align:'center',ls:-2});
      txt(ctx,name,x,cy-182,{size:28,color:gone?BAD:DIM,align:'center',ls:2,weight:500});
      if(gone)txt(ctx,'left their tab',x,cy+216,{size:25,color:BAD,align:'center',weight:500});
    });
  });
  alpha(ctx,io*seg(t,20.1,20.6,outC),()=>
    txt(ctx,'ONE LINK. NO ACCOUNT. HIGHEST FOCUS WINS.',W/2,H-170,
        {size:48,font:ECZAR,weight:700,align:'center',ls:3}));
  alpha(ctx,io*seg(t,22.9,23.3,outC),()=>{
    txt(ctx,'HEAD TO HEAD',W/2,192,{size:21,color:FAINT,align:'center',ls:6});
    txt(ctx,'4 – 2',W/2,268,{size:62,font:ECZAR,weight:700,align:'center',ls:2});});
}

/* ===================== S5  QUICKFIRE  23.8 – 27.2 ====================== */
const QF=[['Focus Fingerprint','your sharpest hour, found'],
          ['Comeback streak','fifteen minutes wins it back'],
          ['Voice journal','sixty seconds, transcribed'],
          ['Focus sounds','generated live, never loops'],
          ['Ten levels','Drifter to Study Sage']];
function s5(ctx,t){
  chapter(ctx,t,'AND',23.8,27.1);
  QF.forEach(([title,sub],i)=>{
    const a=23.95+i*.56, io=seg(t,a,a+.3,outQ)*(1-seg(t,a+1.5,a+1.85));
    if(io<=.001)return;
    const y=H/2-260+i*130, sl=(1-seg(t,a,a+.4,outQ))*90;
    alpha(ctx,io,()=>{
      dot(ctx,W/2-470+sl,y-14,9,ACC);
      txt(ctx,title,W/2-430+sl,y,{size:52,font:ECZAR,weight:700});
      txt(ctx,sub,W/2+60+sl,y,{size:28,color:DIM,weight:400});
    });
  });
}

/* ===================== S6  CTA  27.2 – 30 ============================== */
function s6(ctx,t){
  const io=seg(t,27.2,27.7,outC), cy=H/2-90;
  alpha(ctx,io,()=>mark(ctx,W/2,cy,104,14,1));
  alpha(ctx,seg(t,27.6,28.1,outC),()=>
    txt(ctx,'LOCKIN',W/2,cy+240,{size:104,font:ECZAR,weight:700,align:'center',ls:6}));
  alpha(ctx,seg(t,28.1,28.6,outC),()=>
    txt(ctx,'navneetges-wq.github.io/study-buddy',W/2,cy+300,
        {size:32,color:ACC,align:'center',weight:600}));
  alpha(ctx,seg(t,28.5,29.0,outC),()=>
    txt(ctx,'Free.  No account.  Nothing leaves your laptop.',W/2,cy+356,
        {size:27,color:FAINT,align:'center',weight:400,ls:.5}));
}

function drawFrame(ctx,t){
  ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
  if(t<3.05)s1(ctx,t);
  if(t>=3.0&&t<11.3)s2(ctx,t);
  if(t>=11.2&&t<17.7)s3(ctx,t);
  if(t>=17.6&&t<23.9)s4(ctx,t);
  if(t>=23.8&&t<27.3)s5(ctx,t);
  if(t>=27.2)s6(ctx,t);
  vignette(ctx);
  progressbar(ctx,t);
  const f=1-seg(t,0,.4)+seg(t,29.6,30);
  if(f>0){ctx.fillStyle=BG;ctx.globalAlpha=clamp(f);ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
}
