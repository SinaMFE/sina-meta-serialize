

class Welcome extends React.Component {

  constructor(props: {a: string, b: number}) {
    super(props);
  }

  render() {
    return <h1>Hello, {this.props.name}</h1>;
  }
}