## Style Guide

Our Smart contract will follow the Solidity's style guide [here](https://docs.soliditylang.org/en/v0.8.9/style-guide.html)
with a few additions to it.

### Contract

We will use the section dividers like the follow to help us keep each section separated and make it easier to search for
relevant section easily.

The sections will be in the following order:

1. Type Declaration
2. State Variables
3. Modifiers
4. Events
5. Constructor
6. Public Functions
7. External Functions
8. Internal Functions
9. Private Functions

```js
///////////////////////////////////
// State Variables
///////////////////////////////////
```

For the state Variables, the follow ordering is used:

1. constant
2. immutable
3. non-mappings
4. mappings
