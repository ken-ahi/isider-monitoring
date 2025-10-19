const style = {
  width: "100%",
  height: "200px",
  backgroundColor: "khaki",
};

export const ChildArea = (props) => {
  const { open } = props;
  console.log("ChildAreaがレンダリングされた");

  const data = [...Array(2000).keys()];

  data.forEach(() => {
    console.log("...");
  });

  console.log(data);

  return (
    <>
      {open ? (
        <div style={style}>
          <p>子どもコンポーネント</p>
        </div>
      ) : null}
    </>
  );
};
