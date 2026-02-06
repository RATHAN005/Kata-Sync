public class SpinWords {

    public static String spinWords(String sentence) {
        String[] words = sentence.split(" ");
        StringBuilder result = new StringBuilder();

        for (int i = 0; i < words.length; i++) {
            String word = words[i];

            if (word.length() >= 5) {
                result.append(new StringBuilder(word).reverse());
            } else {
                result.append(word);
            }

            if (i < words.length - 1) {
                result.append(" ");
            }
        }

        return result.toString();
    }
}

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class SpinWordsTest {
    @Test
    public void test() {
      assertEquals("emocleW", new SpinWords().spinWords("Welcome"));
      assertEquals("Hey wollef sroirraw", new SpinWords().spinWords("Hey fellow warriors"));
    }
    
}