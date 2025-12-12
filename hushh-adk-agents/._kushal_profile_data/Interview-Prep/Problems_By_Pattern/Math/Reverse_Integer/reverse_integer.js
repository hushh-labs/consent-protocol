// Reverse Integer - JavaScript implementation
// Time Complexity: O(log(x)) where x is the input number
// Space Complexity: O(1)

const highestPlaceValue = (n) => {
    if (n === 0) return 0;
    const num = Math.abs(n);
    const digits = Math.floor(Math.log10(num)) + 1;
    return Math.pow(10, digits - 1);
};

function reverse(x) {
    if (x === 0) return 0;

    const isNegative = x < 0;
    const num = Math.abs(x);
    let placeValue = highestPlaceValue(num);
    let reversed = 0;
    let temp = num;
    const INT_MAX = Math.pow(2, 31) - 1;
    const INT_MIN = -Math.pow(2, 31);

    while (temp > 0) {
        const digit = temp % 10;
        const contribution = digit * placeValue;

        // Check for overflow before adding
        if (reversed > INT_MAX - contribution) {
            return 0;
        }
        reversed += contribution;

        temp = Math.floor(temp / 10);
        placeValue = Math.floor(placeValue / 10);
    }

    return isNegative ? -reversed : reversed;
}

module.exports = { reverse };

