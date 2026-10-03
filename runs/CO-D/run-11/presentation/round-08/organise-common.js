// Shared seed data + helpers for the three organise comparison prototypes.
window.SEED = [
  { id:1, title:'Mars Exploration Program — NASA', host:'nasa.gov',
    url:'https://www.nasa.gov/mars-exploration',
    desc:'NASA’s ongoing robotic exploration of Mars.',
    icon:'https://www.google.com/s2/favicons?domain=nasa.gov&sz=64',
    folder:'Space', tags:['space','to-read'] },
  { id:2, title:'James Webb Telescope images — NASA', host:'nasa.gov',
    url:'https://www.nasa.gov/webb-images',
    desc:'The latest deep-field images from the James Webb Space Telescope.',
    icon:'https://www.google.com/s2/favicons?domain=nasa.gov&sz=64',
    folder:'Space', tags:['space'] },
  { id:3, title:'Primer on Python Decorators – Real Python', host:'realpython.com',
    url:'https://realpython.com/python-decorators',
    desc:'How decorators work and how to use them.',
    icon:'https://www.google.com/s2/favicons?domain=realpython.com&sz=64',
    folder:'Programming', tags:['python','to-read'] },
  { id:4, title:'Async IO in Python – Real Python', host:'realpython.com',
    url:'https://realpython.com/async-io-python',
    desc:'A complete walkthrough of asyncio.',
    icon:'https://www.google.com/s2/favicons?domain=realpython.com&sz=64',
    folder:'Programming', tags:['python'] },
  { id:5, title:'The Food Lab: How to Cook Perfect Pasta', host:'seriouseats.com',
    url:'https://www.seriouseats.com/perfect-pasta',
    desc:'A step-by-step guide to cooking pasta properly.',
    icon:'https://www.google.com/s2/favicons?domain=seriouseats.com&sz=64',
    folder:'Recipes', tags:['cooking','to-read'] },
  { id:6, title:'The best chef’s knives, tested', host:'seriouseats.com',
    url:'https://www.seriouseats.com/best-chefs-knives',
    desc:'Equipment review of kitchen knives.',
    icon:'https://www.google.com/s2/favicons?domain=seriouseats.com&sz=64',
    folder:'Recipes', tags:['cooking'] }
];
window.esc = function(s){ return (s||'').replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
window.cardHtml = function(it, extra){
  return '<div class="card">' +
    '<div class="fav"><img src="'+it.icon+'" alt="" onerror="this.parentNode.textContent=\'🔖\'"></div>' +
    '<div class="body">' +
      '<p class="title">'+esc(it.title)+'</p>' +
      '<p class="desc">'+esc(it.desc)+'</p>' +
      '<p class="url">'+esc(it.host)+'</p>' +
      (extra||'') +
    '</div></div>';
};
