/**
 * Hide Header on scroll down
 */
import ScrollHelper from './utils/scroll-helper';

const $searchInput = $('#search-input');
const delta = ScrollHelper.getTopbarHeight();

let didScroll;
let lastScrollTop = 0;

function hasScrolled() {
  let st = $(window).scrollTop();

  /* Make sure they scroll more than delta */
  if (Math.abs(lastScrollTop - st) <= delta) {
    return;
  }

  if (st > lastScrollTop) {
    /* Scroll down */
    ScrollHelper.hideTopbar();

    if ($searchInput.is(':focus')) {
      $searchInput.trigger('blur'); /* remove focus */
    }
  } else {
    /* Scroll up */

    // has not yet scrolled to the bottom of the screen, that is, there is still space for scrolling
    if (st + $(window).height() < $(document).height()) {
      if (ScrollHelper.hasScrollUpTask()) {
        return;
      }

      if (ScrollHelper.topbarLocked()) {
        // avoid redundant scroll up event from smooth scrolling
        ScrollHelper.unlockTopbar();
      } else {
        if (ScrollHelper.orientationLocked()) {
          // avoid device auto scroll up on orientation change
          ScrollHelper.unLockOrientation();
        } else {
          ScrollHelper.showTopbar();
        }
      }
    }
  }

  lastScrollTop = st;
} // hasScrolled()

function handleLandscape() {
  if ($(window).scrollTop() === 0) {
    return;
  }
  ScrollHelper.lockOrientation();
  ScrollHelper.hideTopbar();
}

export function switchTopbar() {
  const orientation = screen.orientation;
  if (orientation) {
    orientation.onchange = () => {
      const type = orientation.type;
      if (type === 'landscape-primary' || type === 'landscape-secondary') {
        handleLandscape();
      }
    };
  } else {
    // for the browsers that not support `window.screen.orientation` API
    $(window).on('orientationchange', () => {
      if ($(window).width() < $(window).height()) {
        // before rotating, it is still in portrait mode.
        handleLandscape();
      }
    });
  }

  $(window).on('scroll', () => {
    if (didScroll) {
      return;
    }
    didScroll = true;
  });

  setInterval(() => {
    if (didScroll) {
      hasScrolled();
      didScroll = false;
    }
  }, 250);
}


// 监听颜色模式变化
const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function initLogoImgSwitcher() {

function updateImageSource() {
  const image = document.getElementById('site-logo-imge');
  console.log('gezhaoyou kkkkkkkkkk');
  if (colorSchemeQuery.matches) {
    // 暗黑模式
    console.log('gezhaoyou jjjjjjjj');
    image.src = 'https://fifo.site/wp-content/themes/file/assets/img/avatar.jpg';
  } else {
    // 白色模式
    console.log('gezhaoyou bbbbbbbbbb');
    image.src = 'http://127.0.0.1:4000/commons/logo.png';
  }
}

// 页面加载时初始化图片
window.addEventListener('load', updateImageSource);

// 监听颜色模式变化并更新图片
colorSchemeQuery.addEventListener('change', updateImageSource);
}
