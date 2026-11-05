/* 全站公共导航与页脚：所有页面引入这一个脚本即可，改导航只改这里 */
(function () {
  var NAV = [
    { href: 'index.html', label: '首页' },
    { href: 'daily.html', label: '生活随笔' },
    { href: 'media.html', label: '书影音' },
    { href: 'calendar.html', label: '日历' },
    { href: 'notes.html', label: '记录本' }
  ];

  var here = location.pathname.split('/').pop() || 'index.html';

  var header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML =
    '<div class="inner">' +
      '<a class="brand" href="index.html">我的私人博客</a>' +
      '<nav class="nav">' +
        NAV.map(function (n) {
          var active = (n.href === here) ? ' class="active"' : '';
          return '<a href="' + n.href + '"' + active + '>' + n.label + '</a>';
        }).join('') +
      '</nav>' +
    '</div>';
  document.body.insertBefore(header, document.body.firstChild);

  var footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML =
    '<span>© ' + new Date().getFullYear() + ' 我的私人博客</span>' +
    '<span>慢慢记录属于自己的日常</span>';
  document.body.appendChild(footer);
})();
