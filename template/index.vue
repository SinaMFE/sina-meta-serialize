<template>
    <section class="top_card" :class="[isVideo && 'video_card'  , cardType()]">
        <section class="tcard_main">
            <h2 class="tcard_title">{{title}}</h2>
            <section class="tcard_imgs">
                <img v-for="(img , index) in posters" :key="img + index" class="tcard_poster" :src="img">
            </section>
        </section>
        <h4 class="tcard_subtitle d_r">
            <p class="tcard_source">{{subTitle}}</p>
            <p class="tcard_time">{{time}}</p>
        </h4>
    </section>
</template>

<script lang="ts">

import {Link} from "./module"

enum inputType {
  text = 2,
  fds
}

@Component({
    sname:"testmyonly-comp",
    sversion:version
})
export default class Card extends SPComponent {
    @Design({
        label:"文章链接",
        dataType:Link,
        inputType:inputType.fds,
        description:"文章链接",
        selector:"linkSelector"
    })
    mylink?:Link;
    mounted(){
        console.log("mounted");
    }

    created(){
        console.log("created")
    }
}
</script>

<style>

</style>
