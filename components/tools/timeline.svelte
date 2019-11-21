<script>
  import { onMount } from "svelte";
  import anime from "animejs";
  export let animFunction;

  let anim;
  let progress;
  onMount(() => {
    anim = anime({
      ...animFunction(),
      autoplay: false,
      update: () => {
        progress.value = anim.progress;
      }
    });
  });

  // shoutouts to https://github.com/jameskerr for making the
  // following two functions
  const getTargets = ani => {
    console.log(ani);
    return ani.children.reduce(
      (all, one) => all.concat(getTargets(one)),
      ani.animatables.map(a => a.target)
    );
  };

  const cancelAnim = ani => getTargets(ani).forEach(anime.remove);

  const updateAnim = () => {
    anim.restart();
    anim.pause();
    cancelAnim(anim);
    anim = null;
    anim = anime({
      ...animFunction(),
      autoplay: false,
      update: () => {
        progress.value = anim.progress;
      }
    });
  };
</script>

<button on:click={() => updateAnim()}>(update!)</button>
<button on:click={() => anim.play()}>play</button>
<button on:click={() => anim.pause()}>pause</button>
<button on:click={() => anim.restart()}>restart</button>
<input 
  type="range" 
  min="0" 
  max="100"
  bind:this={progress}
  on:input={(evt) => anim.seek(anim.duration * evt.target.value/100)} 
/>
