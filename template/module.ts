@dataType({
  code: "model.link"
})
export class Link {
  @Design({
    label: "title",
    description: "card 的title"
  })
  web_url?: string;
  @Design({
    label: "副标题",
    dataType: String,
    description: "card的副标题"
  })
  hb_url?: string;
}
