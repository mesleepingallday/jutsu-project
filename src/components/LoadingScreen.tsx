interface Props {
  message: string
}

export function LoadingScreen({ message }: Props) {
  return (
    <div className="loading-screen">
      <h1>影分身の術</h1>
      <div className="spinner" />
      <p>{message}</p>
    </div>
  )
}
