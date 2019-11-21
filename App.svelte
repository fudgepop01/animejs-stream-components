<script>
  import animations from "./components/animModule.js";
  import Timeline from "./components/tools/timeline.svelte";
  import Pg from "./components/shapes/Polygon.svelte";

  import { onMount } from 'svelte';
  import anime from 'animejs';

  let selectedAnimation = animations["lower third"];

  let numSides = 2;
  let curve = 0;

  onMount(() => {
    let thing = anime({
      targets: {value: 3},
      value: 20,
      duration: 5000,
      easing: 'easeInOutBack',
      direction: 'alternate',
      loop: true,
      update(anim) {
        numSides = anim.animations[0].currentValue;
      }
    })
  })
</script>

<style>
  #main-display {
    border: 2px solid #000000;
    background-color: #ffffff;
  }
  main {
    font-family: sans-serif;
    text-align: center;
  }
</style>

<main>

  <select bind:value={selectedAnimation}>
    {#each Object.keys(animations) as anim}
      <option value="{animations[anim]}">{anim}</option>
    {/each}
  </select>
  {#each Object.entries(selectedAnimation.props) as [propName, defValue]}
    <br/>
    <span>{propName}:</span>
    <input bind:value={selectedAnimation.props[propName]} />
  {/each}
  
  <br/>
  <span>num of sides</span>
  <input type="number" bind:value={numSides}/>
  <br/>
  <span>curvature</span>
  <input type="number" bind:value={curve}/>

  <br/>
  <svg id="main-display" width="500" height="500">
    <svelte:component 
      this={selectedAnimation.component} 
      parentWidth="{500}"
      parentHeight="{500}"
      {...selectedAnimation.props}
    />

    <Pg width={100} sides={numSides} curve={curve} style="stroke: #000; fill:transparent; transform: translateX(50px) translateY(50px)" />

  </svg>
  
  <br/>
  <Timeline animFunction={selectedAnimation.animation}/>
</main>