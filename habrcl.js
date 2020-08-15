
(function() {

    if(window.location.hostname != 'habr.com')
    {
        alert('Sorry, only for desktop version of habr.com web site.');
        return;
    }

    var ascr;

    $(document).ready(function() {

        ascr = document.createElement('script');
        ascr.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/jquery.terminal/2.17.6/js/jquery.terminal.min.js');
        document.head.appendChild(ascr);

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/jquery.terminal/2.17.6/css/jquery.terminal.min.css';
        link.media = 'all';
        document.head.appendChild(link);

        var ee = document.createElement('div');
        ee.setAttribute('id', 'term_demo');
        ee.setAttribute('style', 'width:100%; height: 100%; z-index: 1000; position: fixed; top: 0; left: 0;');
        document.body.appendChild(ee);
        document.body.style.overflow = 'hidden';
    });

    var env = { _lastArticles: [], _dirData: [], _dir: '/', USER: 'anonymous', FILTER: '@SteepP,$read', DEPTH: 3, REFRESH_TIMEOUT: 300000, DEBUGGER: false };

    function cd(path) {
        var dd = getPath(path);
        var d = '/' + dd.join('/');
        if (dd.length > 0) {
            var f = rootFolders.find((w) => w.n == '/' + dd[0]);
            if (!f || (!f.allowSubfolders && dd.length > 1))
                return 'Unknow folder: ' + d;

            refreshArticles(f, d);
        }

        env._dirData = dd;
        env._dir = d;
    }

    function getPath(path) {
        var p = (path.indexOf('/') == 0 ? [] : env._dirData.slice());
        path.split('/').forEach((e) => {
            if (!e || e == '.')
                return;

            if (e == '..')
                p.pop();
            else
                p.push(e);
        });

        return p;
    }

    var filterSpecial = (obj) => Object.keys(obj).filter((w) => w.indexOf('_') != 0);

    function set(cmd) {
        if (!cmd)
            return filterSpecial(env).map((e) => e + '=' + env[e]);

        if (cmd.indexOf('=') < 0)
            return "Usage: set [name]=[value]";

        var k = cmd.replace(/=.*$/, '');
        var v = cmd.replace(/^[^=]*=/, '');
        env[k] = v;
    }

    function help(cmd) {
        if (cmd && commands[cmd])
            return cmd + ' - ' + commands[cmd].help;

        return filterSpecial(commands).map((k) => k + ' - ' + commands[k].help);
    }

    function ls(path) {
        if (!path)
            path = env._dir;

        var dd = getPath(path);
        var d = '/' + dd.join('/');

        if (dd.length == 0)
            return rootFolders.map((s) => s.n);

        if (env.DEBUGGER)
            debugger;

        var f = rootFolders.find((s) => s.n == '/' + dd[0])
        if (!f || (!f.allowSubfolders && dd.length > 1))
            return 'Unknown folder: ' + d;

        var pr = new Promise((resolve, reject) => {
            refreshArticles(f, d).then(() => resolve(cachedFolders[d]?.map((s) => s.n)));
        });

        return pr;
    }

    function open(path) {
        return getArticle(path, (dir, article, resolve) => {

            window.open(article.u);
            resolve('opened a page ' + article.u);
        });
    }

    function more(path) {
        return getArticle(path, (dir, article, resolve) => {

            term.pause();

            fetch(article.u).then(r => {

                r.text().then(function(text) {

                    var parser = new DOMParser();
                    var el = parser.parseFromString(text, 'text/html');

                    var txt = [];

                    txt.push('Article: ' + article.n);
                    txt.push(' ');

                    el.documentElement.querySelector('div.post__text').childNodes.forEach((e) => {
                        let t = '';
                        let needLineBreak = false;

                        if (e.nodeType == 3)
                            t = e.wholeText;
                        else {
                            var tagName = e.tagName;
                            if (['P', 'DIV', 'B', 'I', 'H1', 'H2', 'H3', 'H4', 'H5', 'SPAN', 'A'].indexOf(tagName) >= 0)
                                t = e.innerText;
                            else if (['PRE'].indexOf(tagName) >= 0) 
                                e.querySelector('code').innerText.split('\n').forEach((s) => txt.push(s));
                            else if (['UL', 'OL'].indexOf(tagName) >= 0)
                                e.querySelectorAll('li').forEach((s) => {
                                    txt.push(' - ' + s.innerText);
                                    txt.push(' ');
                                });

                            needLineBreak = (['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'PRE', 'UL', 'OL'].indexOf(tagName) >= 0);
                        }

                        t = t.replace(/(^\s+|\s+$)/gs, '');
                        if (t)
                            txt.push(t);

                        if (needLineBreak && txt[txt.length - 1] != ' ')
                            txt.push(' ');
                    });

                    cachedArticles[dir + '/' + article.n] = { a: txt, r: (new Date()).getTime(), u: article.u, n: article.n };

                    resolve(txt);
                });
            });
        });
    }

    function getArticle(path, proc) {
        let dd = getPath(path);
        let fn = dd.pop().replace(/(^"|"$)/, '');
        let d = '/' + dd.join('/');

        if (dd.length == 0)
            return 'please specify a folder or cd to one of available folders';

        var f = rootFolders.find((s) => s.n == '/' + dd[0])
        if (!f || (!f.allowSubfolders && dd.length > 1))
            return 'unknown folder: ' + d;

        var pr = new Promise((resolve, reject) => {
            let a = cachedArticles[d + '/' + fn];

            var now = new Date();

            if (a && a.a && a.r + parseInt(env.REFRESH_TIMEOUT) > now.getTime()) {
                proc(d, a, resolve);
                return;
            };

            refreshArticles(f, d).then(() => {
                let folder = cachedFolders[d];
                if (!folder) {
                    resolve('Cannot find data for a folder ' + d);
                    return;
                }

                let article = folder.find((w) => w.n == fn);
                if (!article) {
                    resolve('Cannot find an article "' + fn + '"');
                    return;
                }

                if (!article.u) {
                    resolve('Cannot find an url for article "' + fn + '"');
                    return;
                }

                proc(d, article, resolve);
            });
        });

        return pr;
    }

    function refresh() {
        cachedArticles = {};
        cachedFolders = {};
        Object.keys(commands).forEach((k) => commands[k].r = 0);
    }

    var commands = {
        whoami: { cmd: () => env.USER, man: 'whoami - print effective userid', help: 'print effective userid' },
        ls: { cmd: ls, man: 'list directory contents', help: 'list directory contents' },
        dir: { cmd: ls, man: 'list directory contents', help: 'list directory contents' },
        pwd: { cmd: () => env._dir, man: '', help: 'print name of current/working directory' },
        cd: { cmd: cd, args: true, man: '', help: 'change the working directory', 'Usage': 'cd [path_to_folder]' },
        set: { cmd: set, man: '', help: 'set or unset values of shell options and positional parameters.' },
        more: { cmd: more, args: true, man: 'file perusal filter for crt viewing', help: 'file perusal filter for crt viewing', usage: 'Usage: more [article name]' },
        less: { cmd: more, args: true, man: 'file perusal filter for crt viewing', help: 'file perusal filter for crt viewing', usage: 'Usage: less [article name]' },
        open: { cmd: open, man: 'open article in a new window', help: 'open article in a new window' },
        clear: { cmd: () => term.clear(), man: 'clear the terminal screen', help: 'clear the terminal screen' },
        help: { cmd: help, man: 'command help', help: 'command help' },
        man: { cmd: (c) => [commands[c]?.man, commands[c]?.usage ], args: true, man: 'manual page', help: 'manual page', usage: 'Usage: man [command]' },
        _refresh: { cmd: refresh, args: false },
    };

    var cachedArticles = {};
    var cachedFolders = {};

    var rootFolders = [
        { n: '/all', u: 'https://habr.com/ru/all/page{{page}}/' },
        { n: '/best_today', u: 'https://habr.com/ru/top/page{{page}}/' },
        { n: '/best_weekly', u: 'https://habr.com/ru/top/weekly/page{{page}}/' },
        { n: '/best_monthly', u: 'https://habr.com/ru/top/monthly/page{{page}}/' },
        { n: '/best_yearly', u: 'https://habr.com/ru/top/yearly/page{{page}}/' },
        { n: '/top10', u: 'https://habr.com/ru/all/top10/page{{page}}/' },
        { n: '/top25', u: 'https://habr.com/ru/all/top25/page{{page}}/' },
        { n: '/top50', u: 'https://habr.com/ru/all/top50/page{{page}}/' },
        { n: '/top100', u: 'https://habr.com/ru/all/top100/page{{page}}/' },
        { n: '/news', u: 'https://habr.com/ru/news/page{{page}}/' }
    ];

    var term;

    function outputToTerm(term, data) {
        if (env.DEBUGGER)
            debugger;

        if (Array.isArray(data))
            data.forEach((e) => { if (e) term.echo(String(e)) });
        else if (data)
            term.echo(String(data));

        term.resume();
    }

    function refreshArticles(q, folderPath) {
        if (!q.u)
            return Promise.resolve();

        let now = new Date();

        if (q.r && q.r + parseInt(env.REFRESH_TIMEOUT) > now.getTime() && cachedFolders[folderPath])
            return Promise.resolve();

        let articles = {};

        let w = [];
        let w1 = [];
        let filter = env.FILTER.split(',') ?? [];

        for (let i = 1; i <= env.DEPTH; i++) {
            let idx = i;
            articles[idx] = [];
            w.push(fetch(q.u.replace('{{page}}', '' + i)).then(r => {

                w1.push(r.text().then(function(text) {

                    var parser = new DOMParser();
                    var el = parser.parseFromString(text, 'text/html');

                    el.documentElement.querySelectorAll('article.post.post_preview').forEach((e) => {

                        var at = {
                            n: e.querySelector('h2.post__title a')?.innerText,
                            u: e.querySelector('h2.post__title a')?.href?.toString(),
                            a: e.querySelector('a.user-info span.user-info__nickname')?.innerText
                        };

                        if (filter.indexOf('@' + at.a) < 0)
                            articles[idx].push(at);
                    });
                }));
            }));
        }

        q.r = now.getTime();

        if (w.length > 0) {
            term.pause();
            let pr = new Promise((resolve, reject) => {

                Promise.all(w).then(() => {
                    Promise.all(w1).then(() => {
                        let d = [];

                        for (let i = 1; i <= env.DEPTH; i++) {
                            d = d.concat(articles[i]);
                        }

                        cachedFolders[folderPath] = d;

                        resolve(d);
                    });
                });

            });

            return pr;
        }

        return Promise.resolve();
    }

    ascr.onload = () => {
        env.USER = document?.querySelector('.btn_navbar_user-dropdown')?.getAttribute('title') ?? 'anonymous';

        jQuery(function($, undefined) {
            $('body').css({ margin: 0, padding: 0 });

            term = $('#term_demo').terminal(function(command) {
                if (command && command !== '') {
                    command = command.replace(/(^ *| *$)/, '');
                    var cmd = command.replace(/ .*/, '');
                    var v = commands[cmd];
                    var c = v?.cmd;
                    if (c) {
                        var args = command.replace(/^[^ ]* +/, '').replace(/(^ *| *$)/, '');
                        if (command.indexOf(' ') < 0)
                            args = '';

                        if (v.args && !args) {
                            this.echo(v.usage ?? v.help);
                            return;
                        }

                        if (env.DEBUGGER)
                            debugger;

                        var result = c(args);
                        if (result instanceof Promise)
                            result.then((d) => outputToTerm(this, d));
                        else
                            outputToTerm(this, result);
                    }
                    else
                        this.echo('Unknown command: ' + cmd);
                }
            }, {
                greetings: 'Command Line Habr',
                name: 'js_habr',
                height: '100%',
                width: '100%',
                prompt: 'habr> '
            });
        });
    };
})();
