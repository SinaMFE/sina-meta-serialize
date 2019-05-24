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
import Fu from './module2';
enum inputType {
  text = 2,
  fds
}

@SComponent({
    sname:"testmyonly-comp",
    sversion:version
})
export default class Card extends SPComponent {
    @Design
    myFu: Fu;
    @Design({
        label:"文章链接",
        dataType:Link,
        inputType:inputType.fds,
        description:"文章链接",
        selector:"linkSelector",
        haha: true,
        rule: [{
            $rule_max_length:10
        },{
            $rule_max_length:100
        }],
        $rule_required: true,
    }, {
        label: "234",

    })
    mylink?: Link | string;

    @Design
    str: string[];
    @Design
    str1: Array<Link>;
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
