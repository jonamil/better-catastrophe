<template>
  <PrimaryButton
    class="open"
    icon="info"
    title="Open introduction"
    :tabindex="viewStore.introPanelVisible ? -1 : ''"
    @click="$emit('toggleIntroPanel')"
  />
  <div ref="intro" class="intro" :class="{ visible: viewStore.introPanelVisible }">
    <div class="outer">
      <div class="inner">
        <div class="languages">
          <a
            v-for="(language, index) in languages"
            :key="index"
            :class="{ active: flowchartLanguage === language.id }"
            :href="flowchartLanguage !== language.id ? language.path : undefined"
          >
            {{ language.label }}
          </a>
        </div>
        <h1>I Want A Better Catastrophe</h1>
        <h2>A flowchart for navigating our climate predicament</h2>
        <p>Global warming is projected to rocket past the 1.5°C limit, throwing lifelong activist <a href="https://bettercatastrophe.com/" target="_blank">Andrew Boyd</a> into a crisis of hope, and off on a quest to learn how to live with the “impossible news” of climate breakdown. With gallows humor and a broken heart, Andrew steers us through our climate angst as he walks his own. This chart (and <a href="https://bettercatastrophe.com/" target="_blank">the book</a> it originally appeared in) is an invitation to join him on his narrative path and explore our predicament on your own.</p>
        <div class="instructions">
          <img src="@/assets/modes.svg" @click="$emit('togglePlayback')" />
          <div v-if="resetActionAvailable" class="reset">
            <span>Want to re-explore from the beginning?</span>
            <button @click="clearStorageKeyAndReload()">Reset progress and start over</button>
          </div>
        </div>
        <h3>How to Use</h3>
        <p>Press the Play button below to start (and pause) Andrew’s explanations of the chart. You can also explore the chart yourself by selecting any visible items and moving along step by step. This experimental interface is an attempt to rethink the flowchart as a well-known genre of information design, integrating narration and interactivity.</p>
        <h3>Background</h3>
        <p>The original version of the flowchart is included as a printed foldout in Andrew’s new book <a href="https://bettercatastrophe.com/" target="_blank">“I Want a Better Catastrophe.”</a></p>
        <a href="https://bettercatastrophe.com/" target="_blank">
          <img src="@/assets/book.png" />
        </a>
        <h3>Credits</h3>
        <p>
          <strong><a href="https://bettercatastrophe.com/" target="_blank">Andrew Boyd</a></strong>Book and original flowchart<br />
          <strong><a href="https://jona.im/" target="_blank">Jona Pomerance</a></strong>Ideation, design and development<br />
          <strong><a href="https://mariandoerk.de/" target="_blank">Marian Dörk</a></strong>Research supervision
        </p>
        <h3>Template</h3>
        <p>The project is powered by the <a href="https://uclab.fh-potsdam.de/interactive-flowchart/" target="_blank">Interactive Flowchart</a> template, which can be used to add interactivity and audio narration to other flowcharts.</p>
        <div class="logos">
          <a href="https://www.fh-potsdam.de/en/" target="_blank"><img src="@/assets/fhp.svg" /></a>
          <a href="https://uclab.fh-potsdam.de/" target="_blank"><img src="@/assets/uclab.svg" /></a>
        </div>
        <p>
          <a href="mailto:andrew@bettercatastrophe.com,hello@jona.im,marian.doerk@fh-potsdam.de?subject=I%20Want%20a%20Better%20Catastrophe%20Flowchart">Contact</a> &nbsp;·&nbsp;
          <a href="https://www.fh-potsdam.de/impressum" target="_blank">Imprint</a> &nbsp;·&nbsp;
          <a href="https://www.fh-potsdam.de/en/privacy" target="_blank">Privacy</a>
        </p>
      </div>
    </div>
    <button class="close" title="Close introduction" @click="$emit('toggleIntroPanel')"></button>
  </div>
</template>

<script>
import { mapStores, mapState, mapWritableState, mapActions } from 'pinia';

import PrimaryButton from '@/components/PrimaryButton.vue';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';
import { useViewStore } from '@/stores/ViewStore.js';

import languages from '@/data/languages.json';

export default {
  name: 'TheIntroPanel',

  components: {
    PrimaryButton
  },

  emits: [
    'togglePlayback',
    'toggleIntroPanel'
  ],

  data() {
    return {
      languages,
      resetAppearanceDelay: 500
    }
  },
  
  computed: {
    ...mapStores(
      useViewStore
    ),
    ...mapState(useFlowchartStore, [
      'flowchartLanguage',
      'currentNodeId'
    ]),
    ...mapWritableState(useFlowchartStore, [
      'resetActionAvailable'
    ])
  },

  methods: {
    ...mapActions(useFlowchartStore, [
      'clearStorageKeyAndReload'
    ])
  },

  watch: {
    // when the node ID changes for the first time, unhide reset prompt
    currentNodeId() {
      if (!this.resetActionAvailable) {
        setTimeout(() => {
          this.resetActionAvailable = true;
        }, this.resetAppearanceDelay);
      }
    },
    // make interactive elements non-keyboard-selectable when intro panel is hidden
    'viewStore.introPanelVisible'() {
      if (this.viewStore.introPanelVisible) {
        this.$refs.intro.querySelectorAll('a, button').forEach(element => {
          element.removeAttribute('tabindex');
        });
      } else {
        this.$refs.intro.querySelectorAll('a, button').forEach(element => {
          element.setAttribute('tabindex', -1);
        });
      }
    }
  }
}
</script>

<style lang="scss">
@import '@/assets/variables.css';

:root {
  --panel-width: 416px;
}

button.open {
  position: absolute;
  top: 16px;
  left: 16px;
  box-shadow: 0 0 0 2px var(--background-color);
}

.intro {
  position: absolute;
  z-index: 100;
  overflow: hidden;
  top: 0;
  bottom: 0;
  left: 0;
  width: 0;
  color: rgba(255,255,255,0.9);
  background: var(--intro-background-color);
  transition: width var(--transition-duration-long) var(--transition-timing);

  &.visible {
    width: var(--panel-width);

    // &:after {
    //   opacity: 1;
    // }

    .inner > *, .inner .instructions *:not(.reset) {
      opacity: 1;
    }
  }

  &:before/*, &:after*/ {
    position: absolute;
    display: block;
    content: '';
    left: 0;
    width: var(--panel-width);
    pointer-events: none;
  }

  &:before {
    z-index: 1;
    bottom: 0;
    height: 224px;
    background:
      linear-gradient(180deg, transparent 0%, var(--intro-background-color) 100%),
      linear-gradient(180deg, transparent 0%, var(--intro-background-color) 100%),
      linear-gradient(180deg, transparent 0%, var(--intro-background-color) 100%);
  }

  // &:after {
  //   z-index: 2;
  //   opacity: 0;
  //   bottom: 80px;
  //   height: 340px;
  //   background-size: var(--panel-width);
  //   background-position: center bottom;
  //   background-repeat: no-repeat;
  //   background-image: url('@/assets/tentacles.png');
  //   transition: opacity var(--transition-duration-long) var(--transition-timing);
  // }

  *::selection {
    color: #fff;
    background: rgb(var(--accent-color));
  }

  .outer {
    position: absolute;
    overflow-y: auto;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
  }

  .inner {
    position: relative;
    width: var(--panel-width);
    padding: 16px 28px 224px;
    box-sizing: border-box;

    > *, .instructions *:not(.reset) {
      opacity: 0;
      transition: opacity var(--transition-duration-long) var(--transition-timing);
    }

    > a {
      display: block;
      margin: 20px 0 40px;

      img {
        width: 100%;
        height: 224px;
        object-fit: contain;
      }
    }
  }

  .languages {
    display: inline-block;
    margin-left: -2px;
    border-radius: 64px;
    background-color: rgba(111,111,111,0.75);
    transition:
      opacity var(--transition-duration-long) var(--transition-timing),
      background var(--transition-duration) var(--transition-timing);

    a {
        display: inline-block;
        box-sizing: border-box;
        height: 32px;
        padding: 7px 16px;
        font-weight: 600;
        text-decoration: none;
        border-radius: 64px;
        
        color: #fff;
        
        &:hover {
          color: inherit;
        }

        &:not(.active):focus-visible {
          background: unset;
        }

        &.active {
          color: var(--background-color);
          background-color: #fff;
        }
    }

    &:has(a:not(.active):hover) {
      background-color: rgba(111,111,111,0.95);
    }
  }

  h1 {
    max-width: 284px;
    margin: 22px 0 0;
    font-size: 30px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  h2 {
    max-width: 256px;
    margin: 6px 0 20px;
    font-size: 20px;
    font-weight: 400;
  }

  h3 {
    margin: 24px 0 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  p {
    margin: 12px 0;
    font-family: 'Vesper Libre', serif;
    font-size: 16px;
    line-height: 1.3;

    strong {
      display: block;
      margin: 8px 0 0;
    }
  }

  a {
    color: inherit;
    text-decoration-color: rgba(var(--accent-color), 0.6);
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
    transition: color var(--transition-duration) var(--transition-timing);

    &:hover {
      color: rgb(var(--accent-color));
    }
  }

  .instructions {
    position: relative;
    display: grid;
    align-items: start;
    opacity: 1 !important;
    margin: 20px 0 72px;

    > * {
      grid-column-start: 1;
      grid-row-start: 1;
    }

    img {
      display: block;
      width: 100%;
      max-width: 290px;
      margin: 0 auto;
    }

    .reset {
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      min-height: 118px;
      margin: 2px -12px 0 -12px;
      padding: 16px 24px 20px;
      text-align: center;
      text-wrap: balance;
      line-height: 1.25;
      border-radius: 8px;
      background: rgba(255,255,255,0.08);
      -webkit-backdrop-filter: blur(24px);
      backdrop-filter: blur(24px);

      button {
        display: block;
        margin: 12px auto 2px;
        padding: 8px 16px;
        appearance: none;
        font-weight: 600;
        border: none;
        border-radius: 64px;
        color: #fff;
        background: rgb(var(--accent-color));
        cursor: pointer;
        transition: opacity var(--transition-duration-long) var(--transition-timing), transform var(--transition-duration) var(--transition-timing) !important;

        &:hover {
          transform: scale(1.0625);
        }
      }
    }
  }

  .logos {
    display: flex;
    align-items: top;
    gap: 32px;
    margin: 58px 0 -8px;

    a {
      flex: 1;
      transition: opacity var(--transition-duration) var(--transition-timing);

      &:first-child {
        flex-basis: 25%;
      }

      &:hover {
        opacity: 0.65;
      }

      img {
        width: 100%;
      }
    }
  }

  button.close {
    position: absolute;
    opacity: 0;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    padding: 0;
    appearance: none;
    border: none;
    border-radius: 100%;
    background-position: center;
    background-image: url('@/assets/icons/close.svg');
    background-color: rgba(111,111,111,0.75);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    cursor: pointer;
    transition-property: opacity, transform, box-shadow;
    transition-duration: var(--transition-duration-long), var(--transition-duration), var(--transition-duration);
    transition-timing-function: var(--transition-timing);

    &:hover {
      transform: scale(1.125);
    }

    @at-root .intro.visible button.close {
      opacity: 1;
    }
  }

  *:focus-visible {
    position: relative;
    background: var(--intro-background-color);
    box-shadow: 0 0 0 2px var(--intro-background-color), 0 0 0 4px var(--focus-color) !important;
  }
}

@media (max-width: 600px) {
  .intro.visible,
  .intro:before,
  .intro:after,
  .intro .inner {
    width: 100vw;
  }
}

// @media (max-height: 650px) {
//   .intro:before {
//     height: 33vh;
//   }
  
//   .intro:after {
//     display: none;
//   }

//   .intro .inner {
//     padding-bottom: 33vh;
//   }
// }
</style>