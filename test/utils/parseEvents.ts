import { Contract } from "ethers";

async function parseEvent(
  promise: Promise<any>,
  eventName: string,
  contract: Contract
) {
  const tx = await promise;

  let receipt = await tx.wait();

  let events = receipt.events?.filter((x: any) => {
    return x.event == eventName;
  });

  return events.map((e: any) => contract.interface.parseLog(e));
}

export default parseEvent;
