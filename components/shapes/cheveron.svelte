<script>
  export let width;
  export let height;
  export let skew;
  export let style;

  let path = '';
  $: {
    path = `
      M ${skew} 0
      H ${skew + width}
      L ${width} ${height / 2}
      L ${skew + width} ${height}
      H ${skew}
      L 0 ${height / 2}
      L ${skew} 0
      Z
    `
  }
</script>

<path d={path}
  {style}
  />