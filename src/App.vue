<template>
  <main>
    <FlowchartView />
  </main>
</template>

<script>
import FlowchartView from '@/components/FlowchartView.vue';

export default {
  name: 'App',

  components: {
    FlowchartView
  }
}
</script>

<style lang="scss">
@import '@/assets/normalize.css';
@import '@/assets/fonts.css';
@import '@/assets/variables.css';

body {
  background: var(--background-color);
}

#app {
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  font-size: 16px;
}
</style>
