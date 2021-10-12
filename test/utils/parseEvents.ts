async function parseEvent(promise, eventName, contract) {
  const tx = await promise;

  let receipt = await tx.wait();

  let events = receipt.events?.filter((x) => {
    return x.event == eventName;
  });

  return events.map((e) => contract.interface.parseLog(e));
}

export default parseEvent;
