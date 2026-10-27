// Getting between the exhibition and an article: a dive through the record's spindle hole
// and back out, or a plain fade when there is no 3D scene, motion is reduced, or the visit
// starts on a shared link.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTransitions({ stage, post, ui, car, cursor, sound, reduced, root, app, records, setAccent, activeIndex, syncActive }) {
  const targetFor = (route) =>
    route.child != null && stage && !stage.compact
      ? { kind: 'mini', parent: route.record, index: route.child }
      : { kind: 'record', index: route.record };

  const cancelFly = () => {
    if (!stage) return;
    stage.fly.index = -1;
    stage.fly.t = 0;
  };

  async function openPost(route, initial) {
    ui.hide();
    const accent = await post.prepare(route);
    cancelFly();
    if (activeIndex() !== route.record) {
      car.jumpTo(route.record);
      syncActive(true);
    }
    car.enabled = false;
    car.dragging = false;
    const target = targetFor(route);
    ui.hide();
    cursor && cursor.set('');
    setAccent(accent);

    if (!stage || reduced || initial) {
      post.open();
      root.classList.add('in-post');
      post.el.classList.add('fade-in');
      requestAnimationFrame(() => post.reveal());
      if (stage) {
        stage.setDived(target);
        stage.paused = true;
      }
      await wait(reduced ? 350 : 600);
      post.el.classList.remove('fade-in');
    } else {
      sound.needle();
      root.classList.add('portal');
      post.open();
      await stage.dive(target, { onInside: () => post.reveal() });
      root.classList.add('in-post');
      root.classList.remove('portal');
      stage.paused = true;
    }
    app.view = 'post';
    app.target = target;
    root.classList.remove('deeplink');
    post.focus();
  }

  async function closePost() {
    const target = app.target;
    sound.lift();
    if (!stage || reduced) {
      post.el.classList.add('fade-out');
      await wait(reduced ? 300 : 450);
      post.close();
      post.el.classList.remove('fade-out');
      root.classList.remove('in-post');
      if (stage) {
        stage.clearDive();
        stage.resume();
      }
      ui.show();
    } else {
      stage.setDived(target);
      stage.resume();
      stage.update(0);
      stage.render();
      root.classList.add('portal');
      root.classList.remove('in-post');
      post.leave();
      await stage.emerge({
        onClosed: () => {
          post.close();
          root.classList.remove('portal');
          ui.show();
        },
      });
    }
    car.enabled = true;
    app.view = 'hero';
    app.target = null;
    setAccent(records[activeIndex()].accent);
    const btn = ui.tlButtons[activeIndex()];
    btn && btn.focus({ preventScroll: true });
  }

  // article to article: the page cross-fades, the scene behind follows silently
  async function swapPost(route) {
    const accent = await post.swap(route);
    setAccent(accent);
    if (activeIndex() !== route.record) {
      car.jumpTo(route.record);
      syncActive(true);
    }
    app.target = targetFor(route);
    if (stage) stage.setDived(app.target);
  }

  return { openPost, closePost, swapPost, cancelFly };
}
